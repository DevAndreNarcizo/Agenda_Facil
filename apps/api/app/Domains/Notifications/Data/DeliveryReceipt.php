<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Data;

final readonly class DeliveryReceipt
{
    public function __construct(public string $providerMessageId) {}
}
