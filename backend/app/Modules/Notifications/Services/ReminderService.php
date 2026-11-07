<?php

declare(strict_types=1);

namespace Modules\Notifications\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Notifications\Contracts\NotificationChannel;
use Modules\Notifications\DataObjects\OutboundMessage;
use Modules\Notifications\Models\MessageDelivery;
use Modules\Scheduling\Enums\AppointmentStatus;
use Modules\Scheduling\Models\Appointment;

/**
 * Outbox de lembretes (SPEC-005). Garante:
 *  - idempotência por (appointment_id, template_name);
 *  - claim com lease por lock_token (um worker expirado não finaliza entrega de outro);
 *  - backoff exponencial em falha transitória;
 *  - envio só de agendamentos ainda 'confirmed' no momento da conclusão (não reenvia).
 */
final class ReminderService
{
    public const string TEMPLATE_REMINDER = 'appointment_reminder';

    private const int LEASE_MINUTES = 10;

    public function __construct(private readonly NotificationChannel $channel) {}

    /**
     * Enfileira lembretes para agendamentos confirmados na janela de 24–25h.
     * Idempotente: duplicados por (appointment_id, template) são ignorados.
     *
     * @return int quantidade enfileirada
     */
    public function queueDueReminders(?Carbon $now = null, int $limit = 25): int
    {
        $now ??= Carbon::now();
        $from = $now->copy()->addHours(24);
        $to = $now->copy()->addHours(25);

        $appointments = Appointment::query()
            ->where('status', AppointmentStatus::Confirmed->value)
            ->whereNull('reminder_sent_at')
            ->whereBetween('start_time', [$from, $to])
            ->limit($limit)
            ->get(['id', 'organization_id']);

        $queued = 0;
        foreach ($appointments as $appointment) {
            $delivery = MessageDelivery::query()->firstOrCreate(
                ['appointment_id' => $appointment->id, 'template_name' => self::TEMPLATE_REMINDER],
                [
                    'organization_id' => $appointment->organization_id,
                    'channel' => $this->channel->name() === 'fake' ? 'whatsapp' : 'whatsapp',
                    'status' => 'pending',
                    'scheduled_for' => $now,
                    'next_attempt_at' => $now,
                ],
            );
            if ($delivery->wasRecentlyCreated) {
                $queued++;
            }
        }

        return $queued;
    }

    /**
     * Reivindica entregas prontas com um lease e as processa. Retorna o resumo.
     *
     * @return array{claimed:int, sent:int, failed:int, skipped:int, unknown:int}
     */
    public function processDue(?Carbon $now = null, int $limit = 25): array
    {
        $now ??= Carbon::now();
        $summary = ['claimed' => 0, 'sent' => 0, 'failed' => 0, 'skipped' => 0, 'unknown' => 0];

        $claimed = $this->claimBatch($now, $limit);
        $summary['claimed'] = $claimed->count();

        foreach ($claimed as $delivery) {
            $outcome = $this->processOne($delivery, $now);
            $summary[$outcome]++;
        }

        return $summary;
    }

    /**
     * Reivindica um lote: recupera leases expirados e marca pending/failed-devidos como processing.
     *
     * @return Collection<int, MessageDelivery>
     */
    private function claimBatch(Carbon $now, int $limit): Collection
    {
        return DB::transaction(function () use ($now, $limit) {
            // Recupera leases expirados (worker anterior morreu): volta a pending.
            MessageDelivery::query()
                ->where('status', 'processing')
                ->where('template_name', self::TEMPLATE_REMINDER)
                ->where('lock_expires_at', '<=', $now)
                ->update([
                    'status' => 'failed',
                    'lock_token' => null,
                    'lock_expires_at' => null,
                    'last_error_code' => 'processing_timeout',
                    'next_attempt_at' => $now,
                ]);

            $candidates = MessageDelivery::query()
                ->whereIn('status', ['pending', 'failed'])
                ->where('template_name', self::TEMPLATE_REMINDER)
                ->where('scheduled_for', '<=', $now)
                ->where('next_attempt_at', '<=', $now)
                ->whereColumn('attempts', '<', 'max_attempts')
                ->orderBy('scheduled_for')
                ->orderBy('created_at')
                ->limit($limit)
                ->lockForUpdate()
                ->get();

            foreach ($candidates as $delivery) {
                $delivery->update([
                    'status' => 'processing',
                    'attempts' => $delivery->attempts + 1,
                    'lock_token' => (string) Str::uuid(),
                    'lock_expires_at' => $now->copy()->addMinutes(self::LEASE_MINUTES),
                    'last_error_code' => null,
                ]);
            }

            return $candidates;
        });
    }

    /**
     * Processa uma entrega reivindicada. Retorna a chave de resumo (sent/failed/skipped/unknown).
     */
    private function processOne(MessageDelivery $delivery, Carbon $now): string
    {
        /** @var Appointment|null $appointment */
        $appointment = Appointment::query()
            ->with(['customer', 'organization'])
            ->where('organization_id', $delivery->organization_id)
            ->whereKey($delivery->appointment_id)
            ->first();

        if ($appointment === null) {
            $this->finalize($delivery, 'failed', 'appointment_not_found', $now);

            return 'failed';
        }

        // Só envia se ainda confirmado (estado pode ter mudado após o claim).
        if ($appointment->status !== AppointmentStatus::Confirmed) {
            $this->finalize($delivery, 'skipped', 'appointment_not_confirmed', $now);

            return 'skipped';
        }

        $customer = $appointment->customer;
        $organization = $appointment->organization;
        if ($customer?->phone === null || $customer === null || $organization === null) {
            $this->finalize($delivery, 'failed', 'missing_recipient_context', $now);

            return 'failed';
        }

        $time = $appointment->start_time->timezone('America/Sao_Paulo')->format('H:i');
        $result = $this->channel->send(new OutboundMessage(
            recipientPhone: (string) $customer->phone,
            templateName: self::TEMPLATE_REMINDER,
            parameters: [$customer->name, $time, $organization->name],
            correlationId: $delivery->id,
        ));

        if ($result->sent) {
            // Completa só se ainda confirmado (relê sob lock) e marca reminder_sent_at.
            return $this->complete($delivery, $appointment->id, $result->providerMessageId, $now);
        }

        if ($result->unknown) {
            $this->finalize($delivery, 'unknown', $result->errorCode ?? 'send_unknown', $now);

            return 'unknown';
        }

        // Falha: backoff se transitória e ainda há tentativas; senão permanece failed definitivo.
        $this->finalize($delivery, 'failed', $result->errorCode ?? 'send_failed', $now, $result->retriable);

        return 'failed';
    }

    private function complete(MessageDelivery $delivery, string $appointmentId, ?string $providerMessageId, Carbon $now): string
    {
        return DB::transaction(function () use ($delivery, $appointmentId, $providerMessageId, $now): string {
            /** @var MessageDelivery|null $fresh */
            $fresh = MessageDelivery::query()->whereKey($delivery->id)->lockForUpdate()->first();
            // Lease perdido (outro worker assumiu): não finaliza.
            if ($fresh === null || $fresh->lock_token !== $delivery->lock_token || $fresh->status !== 'processing') {
                return 'unknown';
            }

            $appointment = Appointment::query()->whereKey($appointmentId)->lockForUpdate()->first();
            if ($appointment === null || $appointment->status !== AppointmentStatus::Confirmed) {
                $fresh->update([
                    'status' => 'unknown', 'lock_token' => null, 'lock_expires_at' => null,
                    'last_error_code' => 'appointment_changed_after_send',
                ]);

                return 'unknown';
            }

            $appointment->update(['reminder_sent_at' => $now]);
            $fresh->update([
                'status' => 'sent', 'sent_at' => $now, 'lock_token' => null,
                'lock_expires_at' => null, 'provider_message_id' => $providerMessageId,
            ]);

            return 'sent';
        });
    }

    private function finalize(MessageDelivery $delivery, string $status, string $errorCode, Carbon $now, bool $retriable = true): void
    {
        $nextAttempt = $delivery->next_attempt_at;
        if ($status === 'failed' && $retriable && $delivery->attempts < $delivery->max_attempts) {
            // Backoff exponencial: 30s * 2^(attempts-1), teto de 1h.
            $seconds = min(3600, 30 * (2 ** max(0, $delivery->attempts - 1)));
            $nextAttempt = $now->copy()->addSeconds($seconds);
        }

        $delivery->update([
            'status' => $status,
            'lock_token' => null,
            'lock_expires_at' => null,
            'last_error_code' => $errorCode,
            'next_attempt_at' => $nextAttempt,
        ]);
    }
}
