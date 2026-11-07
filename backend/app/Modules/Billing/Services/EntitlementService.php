<?php

declare(strict_types=1);

namespace Modules\Billing\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Billing\Exceptions\QuotaExceededException;
use Modules\Billing\Models\UsageCounter;
use Modules\Organizations\Models\Organization;

/**
 * Enforcement REAL dos limites de plano no servidor (corrige a ausência do AUDIT §5).
 * Lê entitlements da versão de plano da assinatura viva e confere contra usage_counters
 * de forma transacional/concorrente.
 */
final class EntitlementService
{
    // Chaves de entitlement conhecidas.
    public const string PROFESSIONALS = 'professionals';

    public const string MONTHLY_APPOINTMENTS = 'monthly_appointments';

    public const string MESSAGES = 'messages';

    public const string PREMIUM_REPORTS = 'premium_reports';

    /**
     * Limite inteiro do recurso para a organização. null = ilimitado (ou sem assinatura viva).
     */
    public function limitFor(Organization $organization, string $key): ?int
    {
        $planVersion = $organization->liveSubscription?->planVersion;

        if ($planVersion === null) {
            return null;
        }

        $planVersion->loadMissing('entitlements');

        return $planVersion->limit($key);
    }

    /**
     * Recurso premium liberado para a organização.
     */
    public function allows(Organization $organization, string $key): bool
    {
        $planVersion = $organization->liveSubscription?->planVersion;

        if ($planVersion === null) {
            return false;
        }

        $planVersion->loadMissing('entitlements');

        return $planVersion->allows($key);
    }

    /**
     * Verifica se há espaço para +$amount no recurso contável (ex.: novo profissional),
     * comparando com a contagem atual fornecida pelo chamador. Lança se estourar.
     */
    public function ensureWithinLimit(Organization $organization, string $key, int $currentCount, int $amount = 1): void
    {
        $limit = $this->limitFor($organization, $key);

        if ($limit === null) {
            return; // ilimitado
        }

        if ($currentCount + $amount > $limit) {
            throw new QuotaExceededException($key, $limit, $currentCount);
        }
    }

    /**
     * Consome cota mensal de forma transacional e concorrente (ex.: agendamentos/mês, mensagens).
     * Usa upsert + lock para evitar corrida; respeita o limite do plano. Lança se estourar.
     */
    public function consumeMonthly(Organization $organization, string $key, int $amount = 1, ?Carbon $when = null): int
    {
        $period = ($when ?? Carbon::now())->format('Y-m');
        $limit = $this->limitFor($organization, $key);

        return DB::transaction(function () use ($organization, $key, $period, $amount, $limit): int {
            /** @var UsageCounter $counter */
            $counter = UsageCounter::query()
                ->where('organization_id', $organization->id)
                ->where('key', $key)
                ->where('period', $period)
                ->lockForUpdate()
                ->first()
                ?? new UsageCounter([
                    'organization_id' => $organization->id,
                    'key' => $key,
                    'period' => $period,
                    'value' => 0,
                ]);

            if ($limit !== null && $counter->value + $amount > $limit) {
                throw new QuotaExceededException($key, $limit, $counter->value);
            }

            $counter->value += $amount;
            $counter->save();

            return $counter->value;
        });
    }

    /**
     * Consumo atual (sem incrementar).
     */
    public function currentUsage(Organization $organization, string $key, ?Carbon $when = null): int
    {
        $period = ($when ?? Carbon::now())->format('Y-m');

        return (int) UsageCounter::query()
            ->where('organization_id', $organization->id)
            ->where('key', $key)
            ->where('period', $period)
            ->value('value');
    }
}
