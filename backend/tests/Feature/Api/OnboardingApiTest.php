<?php

declare(strict_types=1);

use Database\Seeders\PlanCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Modules\Organizations\Models\Organization;
use Modules\Organizations\Services\ProvisioningService;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed(PlanCatalogSeeder::class));

function onboardingPayload(): array
{
    $schedule = [];
    for ($day = 0; $day < 7; $day++) {
        $schedule[] = ['day_of_week' => $day, 'start' => '09:00', 'end' => '18:00', 'active' => $day !== 0];
    }

    return [
        'business_name' => 'Studio Glam',
        'specialty' => 'Estética',
        'segment' => 'estetica',
        'schedule' => $schedule,
        'first_service' => ['name' => 'Limpeza de pele', 'duration_minutes' => 60, 'price_cents' => 12000],
    ];
}

it('conclui o onboarding e marca a organização', function (): void {
    $user = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Dona', 'email' => 'dona@example.com', 'password' => 'senha12345',
        'org_name' => 'Tmp', 'org_slug' => 'studio-glam',
    ]);
    $org = $user->memberships()->firstOrFail()->organization;
    Sanctum::actingAs($user, ['*']);

    expect($org->onboarding_completed_at)->toBeNull();

    $this->postJson('/api/v1/organization/onboarding', onboardingPayload(), ['X-Organization-Id' => $org->id])
        ->assertOk()
        ->assertJsonPath('data.onboarding_completed', true);

    $org->refresh();
    expect($org->onboarding_completed_at)->not->toBeNull()
        ->and($org->name)->toBe('Studio Glam')
        ->and($org->services()->where('name', 'Limpeza de pele')->exists())->toBeTrue();

    // GET organization reflete horários e conclusão.
    $this->getJson('/api/v1/organization', ['X-Organization-Id' => $org->id])
        ->assertOk()
        ->assertJsonPath('data.onboarding_completed', true)
        ->assertJsonCount(7, 'data.business_hours');
});

it('impede não-owner de concluir o onboarding', function (): void {
    // Cria owner A e um segundo usuário B sem vínculo de owner em A (B tem sua própria org).
    $prov = app(ProvisioningService::class);
    $owner = $prov->registerOwner([
        'full_name' => 'A', 'email' => 'a@example.com', 'password' => 'senha12345',
        'org_name' => 'Org A', 'org_slug' => 'org-a',
    ]);
    $orgA = $owner->memberships()->firstOrFail()->organization;

    $intruder = $prov->registerOwner([
        'full_name' => 'B', 'email' => 'b@example.com', 'password' => 'senha12345',
        'org_name' => 'Org B', 'org_slug' => 'org-b',
    ]);
    Sanctum::actingAs($intruder, ['*']);

    // B tentando operar na org de A é barrado pelo contexto de tenant (403).
    $this->postJson('/api/v1/organization/onboarding', onboardingPayload(), ['X-Organization-Id' => $orgA->id])
        ->assertForbidden();
});
