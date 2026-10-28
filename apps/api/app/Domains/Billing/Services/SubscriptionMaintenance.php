<?php

declare(strict_types=1);

namespace App\Domains\Billing\Services;

use App\Domains\Billing\Contracts\BillingProvider;
use Illuminate\Support\Facades\DB;

final class SubscriptionMaintenance
{
    public function __construct(private readonly BillingProvider $provider) {}

    /** Reconciliação periódica de assinaturas já vinculadas; não cria cobranças. @author André Narcizo */
    public function reconcile(): array
    {
        $this->provider->assertAvailable();
        $count = 0;
        foreach (DB::table('subscriptions')->where('provider', $this->provider->name())->whereNotNull('provider_subscription_id')->orderBy('id')->lazy() as $subscription) {
            foreach ($this->provider->payments($subscription->provider_subscription_id) as $payment) {
                $eventId = 'reconcile_'.hash('sha256', $subscription->id.'|'.$payment['id'].'|'.now()->format('Y-m-d-H-i'));
                app(WebhookService::class)->handle($eventId, 'PAYMENT_RECONCILED', $payment['id'], $subscription->provider_subscription_id);
                $count++;
            }
        }

        return ['payments_checked' => $count, 'subscriptions_expired' => $this->expire()];
    }

    /** Expiração usa o relógio do servidor; consultas também recusam acesso expirado. @author André Narcizo */
    public function expire(): int
    {
        $changed = 0;
        foreach (DB::table('subscriptions')->whereIn('status', ['trialing', 'active', 'past_due'])->orderBy('id')->lazy() as $candidate) {
            $changed += DB::transaction(function () use ($candidate): int {
                $subscription = DB::table('subscriptions')->where('id', $candidate->id)->lockForUpdate()->first();
                if (! $subscription || ! in_array($subscription->status, ['trialing', 'active', 'past_due'], true)) {
                    return 0;
                }
                if (SubscriptionService::hasPaidAccess($subscription)) {
                    return 0;
                }
                $status = $subscription->cancel_at_period_end ? 'canceled' : 'suspended';
                DB::table('subscriptions')->where('id', $subscription->id)->update(['status' => $status, 'updated_at' => now()]);
                SubscriptionService::audit($subscription->organization_id, $subscription->id, 'subscription.expired', $subscription->status, $status);

                return 1;
            });
        }

        return $changed;
    }
}
