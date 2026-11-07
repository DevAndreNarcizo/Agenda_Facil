<?php

declare(strict_types=1);

namespace Modules\Billing\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Billing\Enums\SubscriptionStatus;
use Modules\Billing\Models\PlanVersion;
use Modules\Billing\Models\Subscription;
use Modules\Billing\Models\SubscriptionAuditLog;
use Modules\Organizations\Models\Organization;

/**
 * Orquestra o ciclo de vida da assinatura corrigindo os defeitos do AUDIT §5:
 *  - NÃO marca 'active' no checkout: só em pagamento confirmado por evento autenticado.
 *  - Trial não reutilizável: trial_used trava novo trial.
 *  - Status canônico único (SubscriptionStatus).
 *  - Impede assinatura duplicada (reaproveita a assinatura viva da organização).
 *  - Transições auditadas em subscription_audit_logs.
 */
final class SubscriptionService
{
    public const int DEFAULT_TRIAL_DAYS = 14;

    public const int DEFAULT_GRACE_DAYS = 7;

    /**
     * Cria (ou reaproveita) a assinatura "viva" da organização em estado 'incomplete'.
     * Determina elegibilidade a trial sem reiniciá-lo indevidamente.
     */
    public function startCheckout(Organization $organization, PlanVersion $planVersion, string $gateway): Subscription
    {
        return DB::transaction(function () use ($organization, $planVersion, $gateway): Subscription {
            /** @var Subscription|null $existing */
            $existing = Subscription::query()
                ->where('organization_id', $organization->id)
                ->whereNot('status', SubscriptionStatus::Canceled->value)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                // Reaproveita a assinatura viva — não cria uma segunda (evita duplicidade).
                $existing->plan_version_id = $planVersion->id;
                $existing->gateway = $gateway;
                $existing->save();

                return $existing;
            }

            $subscription = new Subscription([
                'organization_id' => $organization->id,
                'plan_version_id' => $planVersion->id,
                'gateway' => $gateway,
                'status' => SubscriptionStatus::Incomplete->value,
                'trial_used' => false,
            ]);
            $subscription->save();

            $this->audit($subscription, 'created', null, SubscriptionStatus::Incomplete, source: 'user');

            return $subscription;
        });
    }

    /**
     * Determina se a organização já usou trial em qualquer assinatura — impede reinício.
     */
    public function organizationHasEverTrialed(Organization $organization): bool
    {
        return Subscription::query()
            ->where('organization_id', $organization->id)
            ->where('trial_used', true)
            ->exists();
    }

    /**
     * Marca o início do período de teste (quando o gateway confirma o trial no checkout).
     * Idempotente: não reinicia trial já usado.
     */
    public function beginTrial(Subscription $subscription, int $trialDays = self::DEFAULT_TRIAL_DAYS): Subscription
    {
        return DB::transaction(function () use ($subscription, $trialDays): Subscription {
            $subscription->refresh();

            if ($subscription->trial_used) {
                return $subscription; // trial não reutilizável
            }

            $from = $subscription->status;
            $subscription->status = SubscriptionStatus::Trialing->value;
            $subscription->trial_used = true;
            $subscription->trial_ends_at = Carbon::now()->addDays($trialDays);
            $subscription->save();

            $this->audit($subscription, 'trial_started', $from, SubscriptionStatus::Trialing, source: 'webhook');

            return $subscription;
        });
    }

    /**
     * Ativa a assinatura APENAS mediante pagamento confirmado (evento autenticado do provedor).
     * Corrige a "marcação prematura de active".
     */
    public function activateFromConfirmedPayment(Subscription $subscription, ?Carbon $periodStart, ?Carbon $periodEnd): Subscription
    {
        return DB::transaction(function () use ($subscription, $periodStart, $periodEnd): Subscription {
            $subscription->refresh();
            $from = $subscription->status;

            $subscription->status = SubscriptionStatus::Active->value;
            $subscription->current_period_start = $periodStart;
            $subscription->current_period_end = $periodEnd;
            $subscription->grace_ends_at = null;
            $subscription->save();

            $this->audit($subscription, 'activated', $from, SubscriptionStatus::Active, source: 'webhook');

            return $subscription;
        });
    }

    /**
     * Renovação confirmada: estende o período vigente.
     */
    public function renew(Subscription $subscription, Carbon $periodStart, Carbon $periodEnd): Subscription
    {
        return DB::transaction(function () use ($subscription, $periodStart, $periodEnd): Subscription {
            $subscription->refresh();
            $from = $subscription->status;

            $subscription->status = SubscriptionStatus::Active->value;
            $subscription->current_period_start = $periodStart;
            $subscription->current_period_end = $periodEnd;
            $subscription->grace_ends_at = null;
            $subscription->save();

            $this->audit($subscription, 'renewed', $from, SubscriptionStatus::Active, source: 'webhook');

            return $subscription;
        });
    }

    /**
     * Cobrança não paga: marca past_due e abre o período de regularização (grace),
     * durante o qual a organização mantém acesso limitado (status Grace concede acesso).
     * Um job agendado move Grace -> Suspended quando grace_ends_at expira.
     */
    public function markPastDue(Subscription $subscription): Subscription
    {
        return DB::transaction(function () use ($subscription): Subscription {
            $subscription->refresh();
            $from = $subscription->status;

            $subscription->status = SubscriptionStatus::Grace->value;
            $subscription->grace_ends_at = Carbon::now()->addDays(self::DEFAULT_GRACE_DAYS);
            $subscription->save();

            $this->audit($subscription, 'past_due', $from, SubscriptionStatus::Grace, source: 'webhook');

            return $subscription;
        });
    }

    /**
     * Suspende assinaturas cujo período de regularização (grace) expirou sem pagamento.
     * Idempotente; pensado para execução periódica (Scheduler).
     *
     * @return int quantidade de assinaturas suspensas
     */
    public function suspendExpiredGrace(?Carbon $now = null): int
    {
        $now ??= Carbon::now();

        $expired = Subscription::query()
            ->where('status', SubscriptionStatus::Grace->value)
            ->whereNotNull('grace_ends_at')
            ->where('grace_ends_at', '<=', $now)
            ->get();

        foreach ($expired as $subscription) {
            $this->suspend($subscription);
        }

        return $expired->count();
    }

    /**
     * Suspende a assinatura (grace esgotado sem pagamento).
     */
    public function suspend(Subscription $subscription): Subscription
    {
        return DB::transaction(function () use ($subscription): Subscription {
            $subscription->refresh();
            $from = $subscription->status;

            $subscription->status = SubscriptionStatus::Suspended->value;
            $subscription->save();

            $this->audit($subscription, 'suspended', $from, SubscriptionStatus::Suspended, source: 'system');

            return $subscription;
        });
    }

    /**
     * Reativa após regularização de pagamento.
     */
    public function reactivate(Subscription $subscription, Carbon $periodStart, Carbon $periodEnd): Subscription
    {
        return DB::transaction(function () use ($subscription, $periodStart, $periodEnd): Subscription {
            $subscription->refresh();
            $from = $subscription->status;

            $subscription->status = SubscriptionStatus::Active->value;
            $subscription->current_period_start = $periodStart;
            $subscription->current_period_end = $periodEnd;
            $subscription->grace_ends_at = null;
            $subscription->cancel_at_period_end = false;
            $subscription->canceled_at = null;
            $subscription->save();

            $this->audit($subscription, 'reactivated', $from, SubscriptionStatus::Active, source: 'webhook');

            return $subscription;
        });
    }

    /**
     * Upgrade/downgrade: troca a versão de plano, preservando o período vigente.
     */
    public function changePlan(Subscription $subscription, PlanVersion $target, ?string $actorUserId = null): Subscription
    {
        return DB::transaction(function () use ($subscription, $target, $actorUserId): Subscription {
            $subscription->refresh();
            $currentPrice = $subscription->planVersion?->price_cents ?? 0;
            $action = $target->price_cents >= $currentPrice ? 'upgraded' : 'downgraded';

            $from = $subscription->status;
            $subscription->plan_version_id = $target->id;
            $subscription->save();

            $this->audit($subscription, $action, $from, $subscription->status, [
                'to_plan_version_id' => $target->id,
            ], $actorUserId, 'user');

            return $subscription;
        });
    }

    /**
     * Cancelamento imediato ou ao fim do período.
     */
    public function cancel(Subscription $subscription, bool $atPeriodEnd, ?string $actorUserId = null): Subscription
    {
        return DB::transaction(function () use ($subscription, $atPeriodEnd, $actorUserId): Subscription {
            $subscription->refresh();
            $from = $subscription->status;

            if ($atPeriodEnd) {
                $subscription->cancel_at_period_end = true;
                $subscription->save();
                $this->audit($subscription, 'cancel_scheduled', $from, $subscription->status, source: 'user', actorUserId: $actorUserId);

                return $subscription;
            }

            $subscription->status = SubscriptionStatus::Canceled->value;
            $subscription->canceled_at = Carbon::now();
            $subscription->save();

            $this->audit($subscription, 'canceled', $from, SubscriptionStatus::Canceled, source: 'user', actorUserId: $actorUserId);

            return $subscription;
        });
    }

    /**
     * Registra uma transição na trilha de auditoria.
     *
     * @param  array<string, mixed>  $context
     */
    private function audit(
        Subscription $subscription,
        string $action,
        ?SubscriptionStatus $from,
        ?SubscriptionStatus $to,
        array $context = [],
        ?string $actorUserId = null,
        string $source = 'system',
    ): void {
        SubscriptionAuditLog::create([
            'organization_id' => $subscription->organization_id,
            'subscription_id' => $subscription->id,
            'action' => $action,
            'from_status' => $from?->value,
            'to_status' => $to?->value,
            'context' => $context ?: null,
            'actor_user_id' => $actorUserId,
            'source' => $source,
        ]);
    }
}
