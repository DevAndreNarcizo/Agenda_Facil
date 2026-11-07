<?php

declare(strict_types=1);

namespace Modules\Scheduling\DataObjects;

use Illuminate\Support\Carbon;

/**
 * Pedido de agendamento validado antes de chegar ao serviço.
 */
final readonly class BookingRequest
{
    public function __construct(
        public ?string $serviceId,
        public ?string $professionalId,
        public ?string $customerId,
        public Carbon $start,
        public Carbon $end,
        public string $source = 'direct',
        public bool $isBlock = false,
    ) {}
}
