<?php

declare(strict_types=1);

use App\Domains\Billing\Services\SubscriptionMaintenance;
use App\Domains\Notifications\Services\DeliveryWorker;
use App\Domains\Notifications\Services\OutboxService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

/** Expira acesso pelo relógio do servidor sem chamar o gateway. @author André Narcizo */
Artisan::command('billing:expire', function (SubscriptionMaintenance $maintenance): int {
    try {
        $this->info('Assinaturas expiradas: '.$maintenance->expire());

        return 0;
    } catch (Throwable) {
        $this->error('Não foi possível atualizar as expirações. Verifique o banco e repita o comando.');

        return 1;
    }
})->purpose('Atualiza localmente assinaturas vencidas, sem chamar o provedor');

/** Reconciliar exige configuração homologada e não cria novas cobranças. @author André Narcizo */
Artisan::command('billing:reconcile', function (SubscriptionMaintenance $maintenance): int {
    if (! config('billing.enabled') || ! config('billing.homologated')) {
        $this->error('Reconciliação desabilitada. Configure e homologue o provedor antes de habilitar BILLING_ENABLED e BILLING_HOMOLOGATED.');

        return 1;
    }
    try {
        $result = $maintenance->reconcile();
        $this->info('Cobranças verificadas: '.$result['payments_checked']);
        $this->info('Assinaturas expiradas: '.$result['subscriptions_expired']);

        return 0;
    } catch (Throwable) {
        // A exceção de transporte pode conter credenciais ou dados pessoais do provedor.
        $this->error('Reconciliação não concluída. Verifique a configuração homologada e a disponibilidade do provedor; depois repita o comando.');

        return 1;
    }
})->purpose('Reconcilia assinaturas já vinculadas ao provedor homologado');

Schedule::command('billing:expire')->hourly()->timezone('UTC')->withoutOverlapping(15);
Schedule::command('billing:reconcile')->everyFifteenMinutes()->timezone('UTC')
    ->when(fn (): bool => (bool) config('billing.enabled') && (bool) config('billing.homologated'))
    ->withoutOverlapping(15);

/** Reparação operacional fechada até aprovação do canal; a fila transacional não envia. @author André Narcizo */
Artisan::command('notifications:enqueue-reminders {--limit=100}', function (OutboxService $outbox): int {
    if (! config('notifications.enabled') || ! config('notifications.homologated')) {
        $this->error('Notificações desabilitadas. Homologue o canal antes de habilitar o processamento operacional.');

        return 1;
    }
    try {
        $this->info('Agendamentos verificados: '.$outbox->enqueueReminders((int) $this->option('limit')));

        return 0;
    } catch (Throwable) {
        $this->error('Não foi possível preparar os lembretes. Verifique o banco e repita o comando.');

        return 1;
    }
})->purpose('Repara a outbox de lembretes confirmados sem enviar mensagens');

Artisan::command('notifications:deliver {--limit=25}', function (DeliveryWorker $worker): int {
    try {
        $counts = $worker->deliverBatch((int) $this->option('limit'));
        $this->info('Entregas: '.json_encode($counts, JSON_THROW_ON_ERROR));

        return 0;
    } catch (Throwable) {
        $this->error('Envio indisponível. O canal deve estar configurado, habilitado e homologado antes do processamento.');

        return 1;
    }
})->purpose('Processa a outbox somente com um canal homologado');

Schedule::command('notifications:enqueue-reminders')->everyFiveMinutes()->timezone('UTC')
    ->when(fn (): bool => (bool) config('notifications.enabled') && (bool) config('notifications.homologated'))->withoutOverlapping(15);
Schedule::command('notifications:deliver')->everyMinute()->timezone('UTC')
    ->when(fn (): bool => (bool) config('notifications.enabled') && (bool) config('notifications.homologated'))->withoutOverlapping(15);
