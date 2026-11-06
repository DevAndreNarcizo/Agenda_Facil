<?php

declare(strict_types=1);

use Database\Seeders\PlanCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Billing\Enums\SubscriptionStatus;
use Modules\Organizations\Services\ProvisioningService;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed(PlanCatalogSeeder::class));

it('concede trial automático no cadastro (acesso imediato ao MVP)', function (): void {
    $user = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Dona', 'email' => 'dona@example.com', 'password' => 'senha12345',
        'org_name' => 'Studio', 'org_slug' => 'studio',
    ]);
    $org = $user->memberships()->firstOrFail()->organization;
    $sub = $org->liveSubscription;

    expect($sub)->not->toBeNull()
        ->and($sub->status)->toBe(SubscriptionStatus::Trialing)
        ->and($sub->grantsPaidAccess())->toBeTrue()
        ->and($sub->trial_used)->toBeTrue()
        ->and($sub->trial_ends_at)->not->toBeNull();
});
