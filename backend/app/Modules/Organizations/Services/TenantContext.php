<?php

declare(strict_types=1);

namespace Modules\Organizations\Services;

use App\Models\User;
use Modules\Organizations\Models\Membership;
use Modules\Organizations\Models\Organization;
use RuntimeException;

/**
 * Portador do contexto de tenant resolvido pelo servidor (singleton por request).
 * Serviços e policies leem daqui — nunca de parâmetros do navegador.
 */
final class TenantContext
{
    private ?Organization $organization = null;

    private ?Membership $membership = null;

    private ?User $user = null;

    public function set(Organization $organization, Membership $membership, User $user): void
    {
        $this->organization = $organization;
        $this->membership = $membership;
        $this->user = $user;
    }

    public function organization(): Organization
    {
        return $this->organization ?? throw new RuntimeException('Contexto de tenant não resolvido.');
    }

    public function membership(): Membership
    {
        return $this->membership ?? throw new RuntimeException('Contexto de tenant não resolvido.');
    }

    public function user(): User
    {
        return $this->user ?? throw new RuntimeException('Contexto de tenant não resolvido.');
    }

    public function hasContext(): bool
    {
        return $this->organization !== null;
    }
}
