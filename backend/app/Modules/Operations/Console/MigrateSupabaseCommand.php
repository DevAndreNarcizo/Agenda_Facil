<?php

declare(strict_types=1);

namespace Modules\Operations\Console;

use Illuminate\Console\Command;
use Modules\Operations\Services\MigrationReconciliationService;
use Modules\Operations\Services\SupabaseMigrationService;

/**
 * Migra um dump lógico do Supabase (JSON) para o PostgreSQL próprio, reversível e idempotente.
 *
 * Uso:
 *   php artisan migrate:supabase caminho/dump.json [--dry-run]
 *
 * O dump é um JSON { "organizations": [...], "profiles": [...], "services": [...], ... }
 * extraído do Supabase (ex.: via API REST ou export). Nunca toca a origem.
 */
final class MigrateSupabaseCommand extends Command
{
    protected $signature = 'migrate:supabase {dump : caminho do arquivo JSON do dump} {--dry-run : apenas valida/reconcilia sem persistir}';

    protected $description = 'Migra dados do Supabase (dump JSON) para o PostgreSQL próprio, preservando IDs.';

    public function handle(
        SupabaseMigrationService $migration,
        MigrationReconciliationService $reconciliation,
    ): int {
        $path = (string) $this->argument('dump');
        if (! is_file($path)) {
            $this->error("Arquivo de dump não encontrado: {$path}");

            return self::FAILURE;
        }

        /** @var array<string, list<array<string, mixed>>> $dump */
        $dump = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);

        $this->info('Tabelas no dump: '.implode(', ', array_keys($dump)));

        if ($this->option('dry-run')) {
            $this->warn('Dry-run: nada será persistido. Apenas contagens do dump:');
            foreach ($dump as $table => $rows) {
                $this->line(sprintf('  %-32s %d linhas', $table, count($rows)));
            }

            return self::SUCCESS;
        }

        $this->info('Importando (transação única)...');
        $inserted = $migration->migrate($dump);

        foreach ($inserted as $table => $count) {
            $this->line(sprintf('  %-24s %d inseridas', $table, $count));
        }

        $this->info('Reconciliação pós-migração:');
        $report = $reconciliation->reconcile($dump);
        foreach ($report['counts'] as $table => $c) {
            $mark = $c['ok'] ? 'OK' : 'DIVERGENTE';
            $this->line(sprintf('  %-16s origem=%d destino=%d [%s]', $table, $c['source'], $c['target'], $mark));
        }
        foreach ($report['orphans'] as $kind => $n) {
            $this->line(sprintf('  órfãos %-28s %d', $kind, $n));
        }

        if (! $report['ok']) {
            $this->error('Reconciliação encontrou divergências ou órfãos. Revise antes do cutover.');

            return self::FAILURE;
        }

        $this->info('Migração concluída e reconciliada com sucesso.');

        return self::SUCCESS;
    }
}
