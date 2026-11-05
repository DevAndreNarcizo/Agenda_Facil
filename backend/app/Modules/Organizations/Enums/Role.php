<?php

declare(strict_types=1);

namespace Modules\Organizations\Enums;

/**
 * Papéis de membership com permissões explícitas.
 */
enum Role: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Employee = 'employee';

    /**
     * Proprietário/administrador: gerenciam a organização (equipe, serviços, configurações).
     */
    public function isManager(): bool
    {
        return in_array($this, [self::Owner, self::Admin], true);
    }

    public function isOwner(): bool
    {
        return $this === self::Owner;
    }
}
