<?php

declare(strict_types=1);

use Database\Seeders\PlanCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Services\MigrationReconciliationService;
use Modules\Operations\Services\SupabaseMigrationService;
use Modules\Scheduling\Enums\AppointmentStatus;

uses(RefreshDatabase::class);

/**
 * Prova a migração reversível Supabase -> PostgreSQL próprio com um dump SINTÉTICO
 * no formato do Supabase (ver src/lib/database.types.ts), validando mapeamentos e IDs.
 */
beforeEach(fn () => $this->seed(PlanCatalogSeeder::class));

function syntheticDump(): array
{
    $ownerId = '00000000-0000-4000-8000-000000000001';
    $employeeId = '00000000-0000-4000-8000-000000000002';
    $orgId = '00000000-0000-4000-8000-0000000000a1';
    $serviceId = '00000000-0000-4000-8000-0000000000b1';
    $customerId = '00000000-0000-4000-8000-0000000000c1';
    $apptId = '00000000-0000-4000-8000-0000000000d1';

    return [
        'profiles' => [
            ['id' => $ownerId, 'full_name' => 'Dona Marina', 'email' => 'marina@ex.com', 'phone' => '11988887777', 'role' => 'owner', 'organization_id' => $orgId, 'created_at' => '2026-01-10T12:00:00Z'],
            ['id' => $employeeId, 'full_name' => 'Ana Func', 'email' => 'ana@ex.com', 'phone' => null, 'role' => 'employee', 'organization_id' => $orgId, 'created_at' => '2026-01-11T12:00:00Z'],
        ],
        'organizations' => [
            [
                'id' => $orgId, 'name' => 'Studio Supa', 'slug' => 'studio-supa', 'owner_id' => $ownerId,
                'primary_color' => '#ff0066', 'logo_url' => null, 'onboarding_completed_at' => '2026-01-12T12:00:00Z',
                'plan_name' => 'pro', 'subscription_status' => 'active',
                'stripe_customer_id' => 'cus_123', 'stripe_subscription_id' => 'sub_123',
                'trial_end' => '2026-01-26T12:00:00Z', 'created_at' => '2026-01-10T12:00:00Z',
            ],
        ],
        'organization_settings' => [
            ['organization_id' => $orgId, 'specialty' => 'Estética', 'segment' => 'estetica', 'timezone' => 'America/Sao_Paulo'],
        ],
        'services' => [
            ['id' => $serviceId, 'organization_id' => $orgId, 'name' => 'Limpeza', 'category' => 'Pele', 'duration_minutes' => 60, 'price' => 120.5, 'is_active' => true],
        ],
        'customers' => [
            ['id' => $customerId, 'organization_id' => $orgId, 'name' => 'Cliente X', 'phone' => '(11) 97777-6666', 'created_at' => '2026-01-15T12:00:00Z', 'updated_at' => '2026-01-15T12:00:00Z'],
        ],
        'appointments' => [
            ['id' => $apptId, 'organization_id' => $orgId, 'service_id' => $serviceId, 'employee_id' => $employeeId, 'customer_id' => $customerId, 'start_time' => '2026-02-01T13:00:00Z', 'end_time' => '2026-02-01T14:00:00Z', 'status' => 'confirmed', 'booking_source' => 'instagram', 'is_blocked' => false, 'created_at' => '2026-01-20T12:00:00Z'],
        ],
        'organization_business_hours' => [
            ['organization_id' => $orgId, 'day_of_week' => 1, 'start_time' => '09:00', 'end_time' => '18:00', 'is_active' => true],
        ],
    ];
}

it('migra preservando IDs e mapeando preço, profissional e assinatura', function (): void {
    $dump = syntheticDump();
    $inserted = app(SupabaseMigrationService::class)->migrate($dump);

    // IDs preservados.
    expect(DB::table('organizations')->where('id', $dump['organizations'][0]['id'])->exists())->toBeTrue()
        ->and(DB::table('users')->where('id', $dump['profiles'][0]['id'])->exists())->toBeTrue()
        ->and(DB::table('appointments')->where('id', $dump['appointments'][0]['id'])->exists())->toBeTrue();

    // services.price (120.50 reais) -> price_cents 12050.
    expect((int) DB::table('services')->where('id', $dump['services'][0]['id'])->value('price_cents'))->toBe(12050);

    // appointments.employee_id -> professional_id (= id do profile employee).
    $appt = DB::table('appointments')->where('id', $dump['appointments'][0]['id'])->first();
    expect($appt->professional_id)->toBe($dump['profiles'][1]['id'])
        ->and($appt->status)->toBe(AppointmentStatus::Confirmed->value)
        ->and($appt->booking_source)->toBe('instagram');

    // Assinatura derivada dos campos inline da organização.
    $sub = DB::table('subscriptions')->where('organization_id', $dump['organizations'][0]['id'])->first();
    expect($sub->status)->toBe('active')
        ->and($sub->gateway_subscription_id)->toBe('sub_123')
        ->and((bool) $sub->trial_used)->toBeTrue();
    expect(DB::table('billing_customers')->where('gateway_customer_id', 'cus_123')->exists())->toBeTrue();

    // telefone normalizado do cliente.
    expect(DB::table('customers')->where('id', $dump['customers'][0]['id'])->value('phone_normalized'))->toBe('11977776666');

    // contagens inseridas.
    expect($inserted['organizations'])->toBe(1)
        ->and($inserted['services'])->toBe(1)
        ->and($inserted['appointments'])->toBe(1)
        ->and($inserted['memberships'])->toBe(2);
});

it('usa senha nula (exige redefinição) por padrão', function (): void {
    app(SupabaseMigrationService::class)->migrate(syntheticDump());
    expect(DB::table('users')->whereNotNull('password')->count())->toBe(0);
});

it('reconcilia contagens e não acusa órfãos após a migração', function (): void {
    $dump = syntheticDump();
    app(SupabaseMigrationService::class)->migrate($dump);

    $report = app(MigrationReconciliationService::class)->reconcile($dump);

    expect($report['ok'])->toBeTrue()
        ->and($report['counts']['organizations']['ok'])->toBeTrue()
        ->and($report['counts']['appointments']['ok'])->toBeTrue()
        ->and(array_sum($report['orphans']))->toBe(0);
});
