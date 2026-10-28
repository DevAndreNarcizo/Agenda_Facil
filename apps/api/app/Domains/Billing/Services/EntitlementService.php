<?php

declare(strict_types=1);

namespace App\Domains\Billing\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class EntitlementService
{
    public function assertCanCreate(string $organizationId, string $resource): void
    {
        DB::transaction(fn () => $this->check($organizationId, $resource, 1));
    }

    /** Revalida e consome dentro da transação da operação protegida. @author André Narcizo */
    public function consume(string $organizationId, string $resource, int $amount = 1): void
    {
        abort_unless($amount > 0, 422, 'Consumo inválido.');
        DB::transaction(function () use ($organizationId, $resource, $amount): void {
            // Profissionais usam o inventário atual; a checagem prévia ocorre antes do INSERT.
            if ($resource === 'professionals') {
                $this->check($organizationId, $resource, 0);

                return;
            }
            $this->check($organizationId, $resource, $amount);
            if (in_array($resource, ['appointments', 'messages'], true)) {
                $period = $this->period($organizationId);
                DB::table('usage_counters')->insertOrIgnore(['id' => (string) Str::uuid(), 'organization_id' => $organizationId, 'resource' => $resource, 'period' => $period, 'consumed' => 0, 'created_at' => now(), 'updated_at' => now()]);
                DB::table('usage_counters')->where('organization_id', $organizationId)->where('resource', $resource)->where('period', $period)->increment('consumed', $amount, ['updated_at' => now()]);
            }
        });
    }

    private function check(string $organizationId, string $resource, int $amount): void
    {
        abort_unless(in_array($resource, ['professionals', 'appointments', 'messages', 'premium', 'settings'], true), 422, 'Recurso de plano desconhecido.');
        $subscription = DB::table('subscriptions')->where('organization_id', $organizationId)->lockForUpdate()->first();
        abort_unless($subscription && SubscriptionService::hasPaidAccess($subscription), 402, 'Regularize sua assinatura para criar novas operações.');
        $entitlement = DB::table('plan_entitlements')->where('plan_version_id', $subscription->plan_version_id)->where('resource', $resource)->first();
        abort_unless($entitlement, 403, 'Recurso não incluído no plano.');
        $limit = $entitlement->limit_value;
        if ($limit === null && in_array($resource, ['professionals', 'appointments'], true)) {
            return;
        }
        abort_unless($limit !== null, 403, 'Recurso não incluído no plano.');
        $consumed = match ($resource) {
            'professionals' => DB::table('professionals')->where('organization_id', $organizationId)->where('is_active', true)->count(),
            'appointments', 'messages' => (int) DB::table('usage_counters')->where('organization_id', $organizationId)->where('resource', $resource)->where('period', $this->period($organizationId))->value('consumed'),
            default => 0,
        };
        abort_if($consumed + $amount > (int) $limit, 403, 'Limite do plano atingido.');
    }

    private function period(string $organizationId): string
    {
        $timezone = DB::table('organizations')->where('id', $organizationId)->value('timezone') ?? 'America/Sao_Paulo';

        return CarbonImmutable::now($timezone)->format('Y-m');
    }
}
