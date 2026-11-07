<?php

declare(strict_types=1);

namespace Modules\Operations\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Snapshot lógico (export/import) das tabelas de domínio, preservando IDs/relacionamentos.
 * Serve como verificação de restauração testável e como base de migração reversível de dados.
 *
 * ponytail: snapshot de uma organização inteira em memória. Teto: datasets grandes — para
 * volume de produção, usar pg_dump/pg_restore (scripts/backup.sh). Aqui é verificação de integridade.
 */
final class SnapshotService
{
    /**
     * Ordem respeita dependências de FK para import sem violar integridade.
     *
     * @var list<string>
     */
    private const array TABLES = [
        'users',
        'organizations',
        'organization_settings',
        'memberships',
        'plans',
        'plan_versions',
        'plan_entitlements',
        'billing_customers',
        'subscriptions',
        'invoices',
        'payments',
        'usage_counters',
        'subscription_audit_logs',
        'services',
        'professionals',
        'customers',
        'appointments',
        'business_hours',
        'public_booking_settings',
        'message_deliveries',
    ];

    /**
     * Exporta todas as linhas das tabelas de domínio como estrutura serializável.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function export(): array
    {
        $snapshot = [];
        foreach (self::TABLES as $table) {
            if (Schema::hasTable($table)) {
                $snapshot[$table] = DB::table($table)->get()->map(fn ($row) => (array) $row)->all();
            }
        }

        return $snapshot;
    }

    /**
     * Importa um snapshot em um banco limpo, preservando IDs. Em transação única.
     *
     * @param  array<string, list<array<string, mixed>>>  $snapshot
     */
    public function import(array $snapshot): void
    {
        DB::transaction(function () use ($snapshot): void {
            foreach (self::TABLES as $table) {
                $rows = $snapshot[$table] ?? [];
                foreach (array_chunk($rows, 500) as $chunk) {
                    if ($chunk !== []) {
                        DB::table($table)->insert($chunk);
                    }
                }
            }
        });
    }

    /**
     * Conta linhas por tabela — usado para verificar a restauração.
     *
     * @return array<string, int>
     */
    public function counts(): array
    {
        $counts = [];
        foreach (self::TABLES as $table) {
            if (Schema::hasTable($table)) {
                $counts[$table] = DB::table($table)->count();
            }
        }

        return $counts;
    }
}
