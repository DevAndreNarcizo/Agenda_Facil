<?php

declare(strict_types=1);

namespace Modules\Scheduling\Enums;

/**
 * Status do agendamento (canônico; preserva os valores do sistema atual, incl. 'cancelled').
 */
enum AppointmentStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function isActive(): bool
    {
        return $this !== self::Cancelled;
    }
}
