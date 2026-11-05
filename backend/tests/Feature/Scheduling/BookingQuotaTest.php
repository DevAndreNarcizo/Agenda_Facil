<?php

declare(strict_types=1);

use Database\Seeders\PlanCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Modules\Billing\Exceptions\QuotaExceededException;
use Modules\Billing\Models\Plan;
use Modules\Billing\Services\EntitlementService;
use Modules\Billing\Services\SubscriptionService;
use Modules\Organizations\Models\Organization;
use Modules\Organizations\Services\ProvisioningService;
use Modules\Professionals\Models\Professional;
use Modules\Scheduling\DataObjects\BookingRequest;
use Modules\Scheduling\Services\SchedulingService;

uses(RefreshDatabase::class);

/**
 * Prova que a cota de agendamentos/mês do plano é aplicada ao criar agendamentos reais
 * (limites não podem ser burlados — missão §7/§DoD).
 */
it('barra o agendamento ao estourar a cota mensal do plano Starter (limite baixo p/ teste)', function (): void {
    $this->seed(PlanCatalogSeeder::class);

    // Reduz o limite do Starter para 2 agendamentos/mês (teste determinístico).
    $starter = Plan::query()->where('code', 'starter')->firstOrFail()->currentVersion;
    $starter->entitlements()->where('key', EntitlementService::MONTHLY_APPOINTMENTS)->update(['value_int' => 2]);

    $user = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Dona', 'email' => 'dona@example.com', 'password' => 'senha12345',
        'org_name' => 'Studio', 'org_slug' => 'studio',
    ]);
    $organization = Organization::query()->where('owner_id', $user->id)->firstOrFail();

    $subscriptions = app(SubscriptionService::class);
    $sub = $subscriptions->startCheckout($organization, $starter, 'fake');
    $subscriptions->activateFromConfirmedPayment($sub, now(), now()->addMonth());
    $organization->refresh();

    $prof = Professional::create(['organization_id' => $organization->id, 'name' => 'Profa.', 'is_active' => true]);
    $scheduling = app(SchedulingService::class);

    $mk = fn (string $s, string $e) => new BookingRequest(null, $prof->id, null, Carbon::parse($s), Carbon::parse($e));

    // 2 agendamentos: ok.
    $scheduling->book($organization, $mk('2026-12-01 09:00', '2026-12-01 10:00'));
    $scheduling->book($organization, $mk('2026-12-01 10:00', '2026-12-01 11:00'));

    // 3º no mesmo mês estoura a cota.
    expect(fn () => $scheduling->book($organization, $mk('2026-12-01 11:00', '2026-12-01 12:00')))
        ->toThrow(QuotaExceededException::class);

    // Mês seguinte: cota renova (janela mensal).
    $next = $scheduling->book($organization, $mk('2027-01-05 09:00', '2027-01-05 10:00'));
    expect($next->exists)->toBeTrue();
});
