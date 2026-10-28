<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Services;

use App\Domains\Scheduling\Models\Appointment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OutboxService
{
    /** Agenda e lembrete persistem juntos; nenhuma chamada externa ocorre nesta transação. @author André Narcizo */
    public function synchronize(Appointment $appointment): void
    {
        DB::transaction(function () use ($appointment): void {
            DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$appointment->organization_id]);
            $current = Appointment::where('organization_id', $appointment->organization_id)->lockForUpdate()->findOrFail($appointment->id);
            $query = DB::table('message_deliveries')->where('organization_id', $current->organization_id)->where('appointment_id', $current->id)
                ->where('template_name', 'appointment_reminder')->where('channel', 'whatsapp');
            $delivery = (clone $query)->lockForUpdate()->first();
            if ($delivery && in_array($delivery->status, ['sent', 'unknown'], true)) {
                return;
            }
            $sameVersion = $delivery && $current->status === 'confirmed' && $current->start_time->isFuture()
                && $current->start_time->equalTo(CarbonImmutable::parse($delivery->appointment_start_time));
            if ($delivery?->status === 'processing' && $sameVersion) {
                return;
            }
            if ($delivery?->status === 'processing' && $delivery->dispatch_started_at) {
                $query->update(['status' => 'unknown', 'error_code' => 'appointment_changed_during_dispatch', 'lease_token' => null, 'lease_expires_at' => null, 'updated_at' => now()]);

                return;
            }
            if ($current->status !== 'confirmed' || $current->start_time->isPast()) {
                if ($delivery) {
                    $query->update(['status' => 'cancelled', 'error_code' => 'appointment_not_eligible', 'lease_token' => null, 'lease_expires_at' => null, 'updated_at' => now()]);
                }

                return;
            }
            $values = ['appointment_start_time' => $current->start_time, 'due_at' => $current->start_time->subHours(24), 'next_attempt_at' => now(), 'status' => 'pending', 'lease_token' => null, 'lease_expires_at' => null, 'dispatch_started_at' => null, 'error_code' => null, 'updated_at' => now()];
            if ($delivery) {
                // Um scan repetido não reinicia o backoff de uma falha da mesma versão da reserva.
                if ($delivery->status === 'failed' && CarbonImmutable::parse($delivery->appointment_start_time)->equalTo($current->start_time)) {
                    return;
                }
                $query->update($values);
            } else {
                DB::table('message_deliveries')->insert(['id' => (string) Str::uuid(), 'organization_id' => $current->organization_id, 'appointment_id' => $current->id, 'channel' => 'whatsapp', 'template_name' => 'appointment_reminder', 'created_at' => now()] + $values);
            }
        }, 3);
    }

    /** Varredura reparadora local e idempotente; os dados pessoais não entram na outbox. @author André Narcizo */
    public function enqueueReminders(int $limit = 100): int
    {
        $count = 0;
        foreach (Appointment::where('status', 'confirmed')->where('start_time', '>', now())->orderBy('start_time')->limit(max(1, min($limit, 1000)))->get() as $appointment) {
            $this->synchronize($appointment);
            $count++;
        }

        return $count;
    }

    /** Crash antes da chamada admite retry; depois dela exige reconciliação manual para evitar duplicidade. @author André Narcizo */
    public function recoverExpiredLeases(): array
    {
        return DB::transaction(function (): array {
            $query = DB::table('message_deliveries')->where('status', 'processing')->where('lease_expires_at', '<=', now());
            $unknown = (clone $query)->whereNotNull('dispatch_started_at')->update(['status' => 'unknown', 'error_code' => 'lease_expired_after_dispatch', 'lease_token' => null, 'lease_expires_at' => null, 'updated_at' => now()]);
            $retried = (clone $query)->whereNull('dispatch_started_at')->update(['status' => 'failed', 'error_code' => 'lease_expired_before_dispatch', 'next_attempt_at' => now(), 'lease_token' => null, 'lease_expires_at' => null, 'updated_at' => now()]);

            return ['unknown' => $unknown, 'retried' => $retried];
        });
    }

    /** Workers disputam cada tenant com o mesmo lock da agenda e revalidam a elegibilidade. @author André Narcizo */
    public function claim(int $limit = 25, ?string $organizationId = null): array
    {
        $candidates = DB::table('message_deliveries')->whereIn('status', ['pending', 'failed'])->where('due_at', '<=', now())->where('next_attempt_at', '<=', now())
            ->where('attempts', '<', max(1, (int) config('notifications.max_attempts', 5)))
            ->when($organizationId, fn ($query) => $query->where('organization_id', $organizationId))->orderBy('due_at')->limit(max(1, min($limit, 100)))->get(['id', 'organization_id', 'appointment_id']);
        $claimed = [];
        foreach ($candidates as $candidate) {
            $row = DB::transaction(function () use ($candidate): ?object {
                DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$candidate->organization_id]);
                $appointment = Appointment::where('organization_id', $candidate->organization_id)->lockForUpdate()->find($candidate->appointment_id);
                $delivery = DB::table('message_deliveries')->where('organization_id', $candidate->organization_id)->where('id', $candidate->id)->lockForUpdate()->first();
                if (! $delivery || ! in_array($delivery->status, ['pending', 'failed'], true) || $delivery->attempts >= max(1, (int) config('notifications.max_attempts', 5)) || CarbonImmutable::parse($delivery->next_attempt_at)->isFuture() || CarbonImmutable::parse($delivery->due_at)->isFuture()) {
                    return null;
                }
                if (! $appointment || $appointment->status !== 'confirmed' || $appointment->start_time->isPast() || ! $appointment->start_time->equalTo(CarbonImmutable::parse($delivery->appointment_start_time))) {
                    DB::table('message_deliveries')->where('id', $delivery->id)->update(['status' => 'cancelled', 'error_code' => 'appointment_not_eligible', 'updated_at' => now()]);

                    return null;
                }
                $token = (string) Str::uuid();
                DB::table('message_deliveries')->where('id', $delivery->id)->update(['status' => 'processing', 'attempts' => $delivery->attempts + 1, 'lease_token' => $token, 'lease_expires_at' => now()->addSeconds(max(60, min(3600, (int) config('notifications.lease_seconds', 600)))), 'dispatch_started_at' => null, 'updated_at' => now()]);

                return (object) ['id' => $delivery->id, 'organization_id' => $delivery->organization_id, 'lease_token' => $token];
            }, 3);
            if ($row) {
                $claimed[] = $row;
            }
        }

        return $claimed;
    }
}
