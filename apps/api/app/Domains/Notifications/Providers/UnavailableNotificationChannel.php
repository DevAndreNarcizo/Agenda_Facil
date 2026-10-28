<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Providers;

use App\Domains\Notifications\Contracts\NotificationChannel;
use App\Domains\Notifications\Data\DeliveryReceipt;
use App\Domains\Notifications\Data\NotificationMessage;

final class UnavailableNotificationChannel implements NotificationChannel
{
    public function assertAvailable(): void
    {
        abort(503, 'Canal de notificações ainda não homologado.');
    }

    public function send(NotificationMessage $message, string $idempotencyKey): DeliveryReceipt
    {
        $this->assertAvailable();
    }
}
