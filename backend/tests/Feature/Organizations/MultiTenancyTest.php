<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Organizations\Enums\Role;
use Modules\Organizations\Models\Membership;
use Modules\Organizations\Models\Organization;
use Modules\Organizations\Services\ProvisioningService;

uses(RefreshDatabase::class);

/**
 * Testes negativos de multi-tenancy com DUAS organizações (missão §6).
 */
function registerOrg(string $email, string $slug): Organization
{
    $user = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Owner', 'email' => $email, 'password' => 'senha12345',
        'org_name' => 'Org '.$slug, 'org_slug' => $slug,
    ]);

    return Organization::query()->where('owner_id', $user->id)->firstOrFail();
}

it('provisiona dono com papel owner e membership ativo', function (): void {
    $org = registerOrg('a@example.com', 'org-a');

    $membership = Membership::query()->where('organization_id', $org->id)->firstOrFail();
    expect($membership->role)->toBe(Role::Owner)
        ->and($membership->isActive())->toBeTrue()
        ->and($org->owner_id)->toBe($membership->user_id);
});

it('provisionamento é transacional — usuário, organização, settings e membership juntos', function (): void {
    $org = registerOrg('b@example.com', 'org-b');

    expect($org->settings()->exists())->toBeTrue()
        ->and($org->memberships()->count())->toBe(1);
});

it('isola memberships entre organizações diferentes', function (): void {
    $orgA = registerOrg('owner-a@example.com', 'empresa-a');
    $orgB = registerOrg('owner-b@example.com', 'empresa-b');

    // O dono de A não tem membership em B e vice-versa.
    expect(Membership::query()->where('organization_id', $orgB->id)->where('user_id', $orgA->owner_id)->exists())->toBeFalse()
        ->and(Membership::query()->where('organization_id', $orgA->id)->where('user_id', $orgB->owner_id)->exists())->toBeFalse();
});

it('garante slug único mesmo com nomes iguais', function (): void {
    $orgA = registerOrg('c@example.com', 'mesma-empresa');
    // Segundo registro com o mesmo slug recebe sufixo.
    $user = app(ProvisioningService::class)->registerOwner([
        'full_name' => 'Owner 2', 'email' => 'd@example.com', 'password' => 'senha12345',
        'org_name' => 'Mesma', 'org_slug' => 'mesma-empresa',
    ]);
    $orgB = Organization::query()->where('owner_id', $user->id)->firstOrFail();

    expect($orgA->slug)->toBe('mesma-empresa')
        ->and($orgB->slug)->not->toBe($orgA->slug)
        ->and($orgB->slug)->toStartWith('mesma-empresa');
});
