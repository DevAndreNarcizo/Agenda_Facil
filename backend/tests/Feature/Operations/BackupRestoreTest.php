<?php

declare(strict_types=1);

use Database\Seeders\DemoSeeder;
use Database\Seeders\PlanCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Operations\Services\SnapshotService;
use Modules\Organizations\Models\Organization;

uses(RefreshDatabase::class);

/**
 * Prova (de forma testável no ambiente) que um snapshot lógico de dados pode ser
 * restaurado com integridade — equivalente à verificação pós-restauração do piloto.
 * Em staging/produção o caminho real é pg_dump/pg_restore (scripts/backup.sh, restore.sh).
 */
it('faz round-trip de backup/restore preservando contagens e IDs', function (): void {
    $this->seed(DemoSeeder::class);

    $snapshot = app(SnapshotService::class);

    // Snapshot "backup" + contagens originais.
    $before = $snapshot->counts();
    $data = $snapshot->export();
    $orgId = Organization::query()->where('slug', 'studio-demo')->value('id');

    expect($before['organizations'])->toBeGreaterThan(0)
        ->and($before['appointments'])->toBeGreaterThan(0);

    // Simula perda total: limpa as tabelas de domínio.
    Schema::disableForeignKeyConstraints();
    foreach (array_reverse(array_keys($before)) as $table) {
        DB::table($table)->delete();
    }
    Schema::enableForeignKeyConstraints();
    expect($snapshot->counts()['organizations'])->toBe(0);

    // Restaura a partir do snapshot.
    $snapshot->import($data);

    // Verificação pós-restauração: contagens idênticas e ID preservado.
    expect($snapshot->counts())->toBe($before)
        ->and(Organization::query()->where('slug', 'studio-demo')->value('id'))->toBe($orgId);
});

it('o snapshot inclui as tabelas de dominio criticas', function (): void {
    $this->seed(PlanCatalogSeeder::class);
    $data = app(SnapshotService::class)->export();

    foreach (['organizations', 'subscriptions', 'appointments', 'plans', 'plan_versions'] as $table) {
        expect($data)->toHaveKey($table);
    }
});
