<?php

declare(strict_types=1);

namespace App\Domains\Billing\Services;

use App\Domains\Billing\Contracts\BillingProvider;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

final class SubscriptionService
{
    public function __construct(private readonly BillingProvider $provider) {}

    public function summary(string $organizationId): ?array
    {
        $subscription = DB::table('subscriptions')->where('organization_id', $organizationId)->first();
        if (! $subscription) {
            return null;
        }
        $version = DB::table('plan_versions')->where('id', $subscription->plan_version_id)->first();
        $plan = DB::table('plans')->where('id', $version->plan_id)->first();

        return [
            'id' => $subscription->id, 'status' => $subscription->status,
            'plan_code' => $plan->code, 'plan_name' => $plan->name, 'synthetic' => $plan->is_synthetic,
            'price_cents' => $version->price_cents, 'currency' => $version->currency,
            'trial_ends_at' => $subscription->trial_ends_at,
            'current_period_end' => $subscription->current_period_end,
            'cancel_at_period_end' => $subscription->cancel_at_period_end,
            'has_access' => self::hasPaidAccess($subscription),
            'entitlements' => DB::table('plan_entitlements')->where('plan_version_id', $version->id)->pluck('limit_value', 'resource')->all(),
            'billing_available' => (bool) config('billing.enabled') && (bool) config('billing.homologated'),
        ];
    }

    /** Reserva local antes da chamada remota; timeout nunca dispara retry de criação. @author André Narcizo */
    public function checkout(string $organizationId, string $planCode, string $key): array
    {
        $this->provider->assertAvailable();
        $version = app(BillingCatalog::class)->version($planCode);
        $subscription = app(TrialService::class)->start($organizationId, $planCode);
        $attempt = DB::transaction(function () use ($organizationId, $subscription, $version, $key): object {
            $current = DB::table('subscriptions')->where('id', $subscription->id)->lockForUpdate()->first();
            abort_if($current->provider_subscription_id !== null, 409, 'Assinatura já vinculada. Utilize troca de plano.');
            $existing = DB::table('billing_checkout_attempts')->where('organization_id', $organizationId)->where('idempotency_key', $key)->first();
            if ($existing) {
                abort_if($existing->plan_version_id !== $version->id, 409, 'Chave idempotente já utilizada para outro plano.');

                return $existing;
            }
            abort_if(DB::table('billing_checkout_attempts')->where('organization_id', $organizationId)->whereIn('status', ['pending', 'ready', 'uncertain'])->exists(), 409, 'Existe checkout em aberto. Reconcilie antes de criar outro.');
            $id = (string) Str::uuid();
            DB::table('billing_checkout_attempts')->insert(['id' => $id, 'organization_id' => $organizationId, 'subscription_id' => $current->id, 'plan_version_id' => $version->id, 'idempotency_key' => $key, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]);

            return (object) ['id' => $id, 'status' => 'new'];
        });
        if ($attempt->status !== 'new') {
            abort_unless($attempt->status === 'ready' && CarbonImmutable::parse($attempt->expires_at)->isFuture(), 409, 'Checkout pendente de reconciliação; nova cobrança não foi criada.');

            return ['url' => $attempt->url, 'checkout_id' => $attempt->id];
        }
        try {
            $result = $this->provider->checkout($subscription, $version, $attempt->id);
            DB::table('billing_checkout_attempts')->where('id', $attempt->id)->update(['status' => 'ready', 'provider_checkout_id' => $result['id'], 'url' => $result['url'], 'expires_at' => $result['expires_at'], 'updated_at' => now()]);
        } catch (Throwable) {
            DB::table('billing_checkout_attempts')->where('id', $attempt->id)->update(['status' => 'uncertain', 'updated_at' => now()]);
            abort(503, 'Não foi possível confirmar o checkout. Reconciliação necessária antes de nova tentativa.');
        }

        return ['url' => $result['url'], 'checkout_id' => $attempt->id];
    }

    public function changePlan(string $organizationId, string $planCode): void
    {
        $this->provider->assertAvailable();
        $version = app(BillingCatalog::class)->version($planCode);
        DB::transaction(function () use ($organizationId, $version): void {
            $subscription = DB::table('subscriptions')->where('organization_id', $organizationId)->lockForUpdate()->first();
            abort_unless($subscription && $subscription->provider_subscription_id && ! $subscription->cancel_at_period_end, 409, 'Assinatura indisponível para troca de plano.');
            $this->provider->changePlan($subscription, $version);
            DB::table('subscriptions')->where('id', $subscription->id)->update(['pending_plan_version_id' => $version->id, 'updated_at' => now()]);
            self::audit($organizationId, $subscription->id, 'plan.change_requested', $subscription->status, $subscription->status);
        });
    }

    public function cancel(string $organizationId, bool $atPeriodEnd): void
    {
        $this->provider->assertAvailable();
        DB::transaction(function () use ($organizationId, $atPeriodEnd): void {
            $subscription = DB::table('subscriptions')->where('organization_id', $organizationId)->lockForUpdate()->first();
            abort_unless($subscription, 404);
            if ($subscription->status === 'canceled' || $subscription->cancel_at_period_end) {
                return;
            }
            $this->provider->cancel($subscription, $atPeriodEnd);
            $status = $atPeriodEnd ? $subscription->status : 'canceled';
            DB::table('subscriptions')->where('id', $subscription->id)->update(['status' => $status, 'cancel_at_period_end' => $atPeriodEnd, 'canceled_at' => now(), 'updated_at' => now()]);
            self::audit($organizationId, $subscription->id, $atPeriodEnd ? 'cancel.scheduled' : 'cancel.immediate', $subscription->status, $status);
        });
    }

    public static function hasPaidAccess(object $subscription): bool
    {
        return match ($subscription->status) {
            'trialing' => $subscription->trial_ends_at !== null && CarbonImmutable::parse($subscription->trial_ends_at)->isFuture(),
            'active' => $subscription->current_period_end !== null && CarbonImmutable::parse($subscription->current_period_end)->isFuture(),
            'past_due' => $subscription->grace_ends_at !== null && CarbonImmutable::parse($subscription->grace_ends_at)->isFuture(),
            default => false,
        };
    }

    public static function audit(string $organizationId, string $subscriptionId, string $action, ?string $from, string $to, ?string $eventId = null): void
    {
        DB::table('subscription_audit_logs')->insert(['id' => (string) Str::uuid(), 'organization_id' => $organizationId, 'subscription_id' => $subscriptionId, 'action' => $action, 'from_status' => $from, 'to_status' => $to, 'provider_event_id' => $eventId, 'created_at' => now()]);
    }
}
