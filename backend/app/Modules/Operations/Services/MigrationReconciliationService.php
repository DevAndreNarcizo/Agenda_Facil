<?php

declare(strict_types=1);

namespace Modules\Operations\Services;

use Illuminate\Support\Facades\DB;

/**
 * Verificação pós-migração: compara contagens de origem × destino e checa integridade
 * referencial básica (sem órfãos). Usado após o import do dump do Supabase.
 */
final class MigrationReconciliationService
{
    /**
     * @param  array<string, list<array<string, mixed>>>  $sourceDump
     * @return array{counts: array<string, array{source:int, target:int, ok:bool}>, orphans: array<string, int>, ok: bool}
     */
    public function reconcile(array $sourceDump): array
    {
        // origem (Supabase) -> destino (tabela canônica) para contagem.
        $countMap = [
            'organizations' => 'organizations',
            'services' => 'services',
            'customers' => 'customers',
            'appointments' => 'appointments',
            'organization_business_hours' => 'business_hours',
        ];

        $counts = [];
        $allOk = true;
        foreach ($countMap as $source => $target) {
            $sourceCount = count($sourceDump[$source] ?? []);
            $targetCount = (int) DB::table($target)->count();
            $ok = $sourceCount === $targetCount;
            $allOk = $allOk && $ok;
            $counts[$target] = ['source' => $sourceCount, 'target' => $targetCount, 'ok' => $ok];
        }

        // Órfãos: agendamentos apontando para organização/serviço/cliente inexistente.
        $orphans = [
            'appointments_without_org' => (int) DB::table('appointments')
                ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('organizations')
                    ->whereColumn('organizations.id', 'appointments.organization_id'))
                ->count(),
            'appointments_bad_service' => (int) DB::table('appointments')
                ->whereNotNull('service_id')
                ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('services')
                    ->whereColumn('services.id', 'appointments.service_id'))
                ->count(),
            'memberships_bad_user' => (int) DB::table('memberships')
                ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('users')
                    ->whereColumn('users.id', 'memberships.user_id'))
                ->count(),
        ];

        $noOrphans = array_sum($orphans) === 0;

        return [
            'counts' => $counts,
            'orphans' => $orphans,
            'ok' => $allOk && $noOrphans,
        ];
    }
}
