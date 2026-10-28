<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Data;

final readonly class NotificationMessage
{
    public function __construct(
        public string $organizationId,
        public string $appointmentId,
        public string $template,
        public string $recipient,
        public array $parameters,
    ) {}
}
