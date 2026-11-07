<?php

declare(strict_types=1);

use Database\Seeders\PlanCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Modules\Analytics\Services\AnalyticsService;
use Modules\Customers\Models\Customer;
use Modules\Organizations\Services\ProvisioningService;
use Modules\Professionals\Models\Professional;
use Modules\Scheduling\Models\Appointment;
use Modules\Services\Models\Service;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(PlanCatalogSeeder::class);
    $owner = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Dona', 'email' => 'dona@example.com', 'password' => 'senha12345',
        'org_name' => 'Studio', 'org_slug' => 'studio',
    ]);
    $this->org = $owner->memberships()->firstOrFail()->organization;
    $this->service = Service::create([
        'organization_id' => $this->org->id, 'name' => 'Corte', 'duration_minutes' => 60, 'price_cents' => 5000, 'is_active' => true,
    ]);
    $this->prof = Professional::create(['organization_id' => $this->org->id, 'name' => 'Ana', 'is_active' => true]);
    $this->customer = Customer::create(['organization_id' => $this->org->id, 'name' => 'Cliente']);
});

function appt(string $orgId, string $serviceId, string $profId, string $customerId, string $start, string $status): void
{
    $s = Carbon::parse($start);
    Appointment::create([
        'organization_id' => $orgId, 'service_id' => $serviceId, 'professional_id' => $profId,
        'customer_id' => $customerId, 'start_time' => $s, 'end_time' => $s->copy()->addHour(), 'status' => $status,
    ]);
}

it('agrega totais por status, faturamento e série diária no período', function (): void {
    $from = Carbon::parse('2026-12-01 00:00:00');
    appt($this->org->id, $this->service->id, $this->prof->id, $this->customer->id, '2026-12-02 09:00', 'completed');
    appt($this->org->id, $this->service->id, $this->prof->id, $this->customer->id, '2026-12-02 11:00', 'confirmed');
    appt($this->org->id, $this->service->id, $this->prof->id, $this->customer->id, '2026-12-03 09:00', 'cancelled');

    $summary = app(AnalyticsService::class)->summary($this->org, $from, $from->copy()->endOfMonth());

    expect($summary['totals']['total'])->toBe(3)
        ->and($summary['totals']['completed'])->toBe(1)
        ->and($summary['totals']['confirmed'])->toBe(1)
        ->and($summary['totals']['cancelled'])->toBe(1)
        ->and($summary['revenue_cents'])->toBe(5000) // só o concluído
        ->and($summary['by_day'])->toHaveCount(1)     // cancelado não entra na série; 2 no dia 02
        ->and($summary['by_day'][0])->toMatchArray(['date' => '2026-12-02', 'count' => 2])
        ->and($summary['top_services'][0])->toMatchArray(['name' => 'Corte', 'count' => 2]);
});

it('expõe o resumo pela API escopado ao tenant', function (): void {
    appt($this->org->id, $this->service->id, $this->prof->id, $this->customer->id, now()->toDateTimeString(), 'completed');

    $token = $this->org->owner->createToken('t')->plainTextToken;

    $this->withToken($token)->getJson('/api/v1/analytics/summary', ['X-Organization-Id' => $this->org->id])
        ->assertOk()
        ->assertJsonPath('data.totals.completed', 1)
        ->assertJsonStructure(['data' => ['period', 'totals', 'revenue_cents', 'by_day', 'top_services']]);
});
