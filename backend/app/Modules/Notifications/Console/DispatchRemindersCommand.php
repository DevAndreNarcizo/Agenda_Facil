<?php

declare(strict_types=1);

namespace Modules\Notifications\Console;

use Illuminate\Console\Command;
use Modules\Notifications\Services\ReminderService;

/**
 * Worker de lembretes: enfileira os devidos e processa a outbox. Chamado pelo Scheduler.
 */
final class DispatchRemindersCommand extends Command
{
    protected $signature = 'reminders:dispatch {--limit=25}';

    protected $description = 'Enfileira e processa lembretes de agendamento (outbox).';

    public function handle(ReminderService $reminders): int
    {
        $limit = (int) $this->option('limit');

        $queued = $reminders->queueDueReminders(limit: $limit);
        $summary = $reminders->processDue(limit: $limit);

        $this->info(sprintf(
            'Lembretes: enfileirados=%d, reivindicados=%d, enviados=%d, falha=%d, pulados=%d, incerto=%d',
            $queued,
            $summary['claimed'],
            $summary['sent'],
            $summary['failed'],
            $summary['skipped'],
            $summary['unknown'],
        ));

        return self::SUCCESS;
    }
}
