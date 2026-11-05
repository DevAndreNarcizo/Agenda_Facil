<?php

declare(strict_types=1);

namespace Modules\Notifications;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\ServiceProvider;
use Modules\Notifications\Channels\FakeNotificationChannel;
use Modules\Notifications\Console\DispatchRemindersCommand;
use Modules\Notifications\Contracts\NotificationChannel;
use RuntimeException;

/**
 * Registra o canal de notificação conforme configuração e agenda o worker de lembretes.
 */
final class NotificationsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(NotificationChannel::class, function (): NotificationChannel {
            $channel = (string) config('notifications.channel', 'fake');

            return match ($channel) {
                'fake' => new FakeNotificationChannel,
                // 'whatsapp' => new Channels\WhatsAppChannel(...), // requer credenciais
                default => throw new RuntimeException("Canal de notificação não suportado: {$channel}"),
            };
        });
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([DispatchRemindersCommand::class]);
        }

        $this->callAfterResolving(Schedule::class, function (Schedule $schedule): void {
            // Enfileira e processa lembretes a cada 5 minutos (apenas quando necessário).
            $schedule->command('reminders:dispatch')->everyFiveMinutes()->withoutOverlapping();
        });
    }
}
