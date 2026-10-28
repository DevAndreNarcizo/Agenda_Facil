<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Contracts;

use App\Domains\Notifications\Data\DeliveryReceipt;
use App\Domains\Notifications\Data\NotificationMessage;

interface NotificationChannel
{
    public function assertAvailable(): void;

    /** A chave permanece igual em retries; só rejeição comprovadamente não enviada pode ser repetida. @author André Narcizo */
    public function send(NotificationMessage $message, string $idempotencyKey): DeliveryReceipt;
}
