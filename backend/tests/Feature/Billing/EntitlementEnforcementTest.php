<?php

declare(strict_types=1);

use Database\Seeders\PlanCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Billing\Exceptions\QuotaExceededException;
use Modules\Billing\Models\Plan;
use Modules\Billing\Services\EntitlementService;
use Modules\Billing\Services\SubscriptionService;
use Modules\Organizations\Models\Organization;
use Modules\Organizations\Services\ProvisioningService;

uses(RefreshDatabase::class);

/**
 * Prova o enforcement REAL de limites de plano no servidor (ausente no sistema legado).
 */
beforeEach(function (): void {
    $this->seed(PlanCatalogSeeder::class);
    $this->entitlements = app(EntitlementService::class);
    $subscriptions = app(SubscriptionService::class);

    $user = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Dona Teste',
        'email' => 'dona@example.com',
        'password' => 'senha12345',
        'org_name' => 'Estúdio Teste',
        'org_slug' => 'estudio-teste',
    ]);
    $this->organization = Organization::query()->where('owner_id', $user->id)->firstOrFail();

    // Assina o Starter (1 profissional, 100 agendamentos/mês) e ativa.
    $starter = Plan::query()->where('code', 'starter')->firstOrFail()->currentVersion;
    $sub = $subscriptions->startCheckout($this->organization, $starter, 'fake');
    $subscriptions->activateFromConfirmedPayment($sub, now(), now()->addMonth());
    $this->organization->refresh();
});

it('lê o limite de profissionais do plano (Starter = 1)', function (): void {
    expect($this->entitlements->limitFor($this->organization, EntitlementService::PROFESSIONALS))->toBe(1);
});

it('bloqueia profissional além do limite do plano', function (): void {
    // 0 atual + 1 = 1 -> ok
    $this->entitlements->ensureWithinLimit($this->organization, EntitlementService::PROFESSIONALS, currentCount: 0);

    // 1 atual + 1 = 2 -> estoura (limite 1)
    expect(fn () => $this->entitlements->ensureWithinLimit($this->organization, EntitlementService::PROFESSIONALS, currentCount: 1))
        ->toThrow(QuotaExceededException::class);
});

it('consome cota mensal de agendamentos e bloqueia ao estourar', function (): void {
    for ($i = 0; $i < 100; $i++) {
        $this->entitlements->consumeMonthly($this->organization, EntitlementService::MONTHLY_APPOINTMENTS);
    }

    expect($this->entitlements->currentUsage($this->organization, EntitlementService::MONTHLY_APPOINTMENTS))->toBe(100);

    expect(fn () => $this->entitlements->consumeMonthly($this->organization, EntitlementService::MONTHLY_APPOINTMENTS))
        ->toThrow(QuotaExceededException::class);
});

it('trata limite nulo como ilimitado (Pro = agendamentos ilimitados)', function (): void {
    $subscriptions = app(SubscriptionService::class);
    $pro = Plan::query()->where('code', 'pro')->firstOrFail()->currentVersion;
    $subscriptions->changePlan($this->organization->liveSubscription, $pro);
    $this->organization->refresh();

    expect($this->entitlements->limitFor($this->organization, EntitlementService::MONTHLY_APPOINTMENTS))->toBeNull();

    // Não lança mesmo consumindo muito.
    for ($i = 0; $i < 200; $i++) {
        $this->entitlements->consumeMonthly($this->organization, EntitlementService::MONTHLY_APPOINTMENTS);
    }
    expect($this->entitlements->currentUsage($this->organization, EntitlementService::MONTHLY_APPOINTMENTS))->toBe(200);
});
