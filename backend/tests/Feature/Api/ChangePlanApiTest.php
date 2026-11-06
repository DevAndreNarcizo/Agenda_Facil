<?php

declare(strict_types=1);

use Database\Seeders\PlanCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Modules\Organizations\Services\ProvisioningService;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed(PlanCatalogSeeder::class));

it('owner troca de plano (trial Starter -> Pro) pela API', function (): void {
    $user = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Dona', 'email' => 'dona@example.com', 'password' => 'senha12345',
        'org_name' => 'Studio', 'org_slug' => 'studio',
    ]);
    $org = $user->memberships()->firstOrFail()->organization;
    Sanctum::actingAs($user, ['*']);

    // Começa no Starter (trial automático).
    $this->getJson('/api/v1/subscription', ['X-Organization-Id' => $org->id])
        ->assertOk()
        ->assertJsonPath('subscription.plan.code', 'starter')
        ->assertJsonPath('subscription.status', 'trialing');

    // Upgrade para Pro.
    $this->postJson('/api/v1/subscription/change-plan', ['plan_code' => 'pro'], ['X-Organization-Id' => $org->id])
        ->assertOk()
        ->assertJsonPath('plan_code', 'pro');

    // Reflete o novo plano (mantém trialing — não houve nova cobrança).
    $this->getJson('/api/v1/subscription', ['X-Organization-Id' => $org->id])
        ->assertOk()
        ->assertJsonPath('subscription.plan.code', 'pro');
});

it('não-owner não pode trocar de plano', function (): void {
    // Owner A e owner B (cada um dono da sua org). B tenta na própria org -> owner, ok;
    // aqui validamos que um papel não-owner é barrado criando um membership admin manualmente.
    $user = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Dona', 'email' => 'dona@example.com', 'password' => 'senha12345',
        'org_name' => 'Studio', 'org_slug' => 'studio',
    ]);
    $org = $user->memberships()->firstOrFail()->organization;

    // Rebaixa o papel do membership para admin (não-owner) para provar o bloqueio.
    $org->memberships()->where('user_id', $user->id)->update(['role' => 'admin']);
    Sanctum::actingAs($user, ['*']);

    $this->postJson('/api/v1/subscription/change-plan', ['plan_code' => 'pro'], ['X-Organization-Id' => $org->id])
        ->assertForbidden();
});
