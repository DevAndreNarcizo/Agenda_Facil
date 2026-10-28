<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Services;

use App\Domains\Billing\Services\EntitlementService;
use App\Domains\Customers\Models\Customer;
use App\Domains\Notifications\Contracts\NotificationChannel;
use App\Domains\Notifications\Data\DeliveryReceipt;
use App\Domains\Notifications\Data\NotificationMessage;
use App\Domains\Notifications\Exceptions\DeliveryRejected;
use App\Domains\Notifications\Providers\UnavailableNotificationChannel;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Scheduling\Models\Appointment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class DeliveryWorker
{
    private readonly NotificationChannel $channel;

    public function __construct(?NotificationChannel $channel = null)
    {
        $this->channel = $channel ?? new UnavailableNotificationChannel;
    }

    /** O provedor padrão recusa envio mesmo que flags sejam ligadas sem um adapter homologado. @author André Narcizo */
    public function deliverBatch(int $limit = 25, ?string $organizationId = null): array
    {
        abort_unless(config('notifications.enabled') && config('notifications.homologated'), 503, 'Notificações desabilitadas até a homologação do canal.');
        $this->channel->assertAvailable();
        $outbox = app(OutboxService::class);
        $recovered = $outbox->recoverExpiredLeases();
        $counts = ['sent' => 0, 'failed' => 0, 'unknown' => $recovered['unknown'], 'cancelled' => 0, 'stale' => 0];
        foreach ($outbox->claim($limit, $organizationId) as $delivery) {
            $message = $this->prepare($delivery->id, $delivery->organization_id, $delivery->lease_token);
            if (! $message) {
                $state = DB::table('message_deliveries')->where('id', $delivery->id)->value('status');
                $counts[in_array($state, ['failed', 'cancelled', 'unknown'], true) ? $state : 'stale']++;

                continue;
            }
            try {
                $receipt = $this->channel->send($message, $delivery->id);
                $counts[$this->complete($delivery->id, $delivery->organization_id, $delivery->lease_token, $receipt) ? 'sent' : 'stale']++;
            } catch (DeliveryRejected) {
                $counts[$this->fail($delivery->id, $delivery->organization_id, $delivery->lease_token, false) ? 'failed' : 'stale']++;
            } catch (Throwable) {
                // Não registrar a exceção: ela pode conter telefone, nome, token ou payload remoto.
                $counts[$this->fail($delivery->id, $delivery->organization_id, $delivery->lease_token, true) ? 'unknown' : 'stale']++;
            }
        }

        return $counts;
    }

    /** Reserva cota uma vez e revalida tenant, status, horário e lease imediatamente antes do envio. @author André Narcizo */
    public function prepare(string $id, string $organizationId, string $leaseToken): ?NotificationMessage
    {
        return DB::transaction(function () use ($id, $organizationId, $leaseToken): ?NotificationMessage {
            DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$organizationId]);
            $candidate = DB::table('message_deliveries')->where('organization_id', $organizationId)->where('id', $id)->first();
            if (! $candidate) {
                return null;
            }
            $appointment = Appointment::where('organization_id', $organizationId)->lockForUpdate()->find($candidate->appointment_id);
            $delivery = DB::table('message_deliveries')->where('organization_id', $organizationId)->where('id', $id)->lockForUpdate()->first();
            if (! $this->ownsLease($delivery, $leaseToken) || $delivery->dispatch_started_at) {
                return null;
            }
            if (! $appointment || $appointment->status !== 'confirmed' || $appointment->start_time->isPast() || ! $appointment->start_time->equalTo(CarbonImmutable::parse($delivery->appointment_start_time))) {
                $this->updateState($id, 'cancelled', 'appointment_not_eligible');

                return null;
            }
            $customer = Customer::where('organization_id', $organizationId)->find($appointment->customer_id);
            $organization = Organization::findOrFail($organizationId);
            if (! $customer || ! is_string($customer->phone) || trim($customer->phone) === '') {
                $this->updateState($id, 'failed', 'recipient_missing', now()->addHour());

                return null;
            }
            if (! $delivery->quota_reserved_at) {
                try {
                    app(EntitlementService::class)->consume($organizationId, 'messages');
                } catch (HttpExceptionInterface $exception) {
                    if (! in_array($exception->getStatusCode(), [402, 403], true)) {
                        throw $exception;
                    }
                    $this->updateState($id, 'failed', 'message_quota_unavailable', now()->addHour());

                    return null;
                }
            }
            DB::table('message_deliveries')->where('id', $id)->update(['quota_reserved_at' => $delivery->quota_reserved_at ?? now(), 'dispatch_started_at' => now(), 'updated_at' => now()]);

            return new NotificationMessage($organizationId, $appointment->id, $delivery->template_name, $customer->phone, [
                'customer_name' => $customer->name,
                'organization_name' => $organization->name,
                'local_start_time' => $appointment->start_time->setTimezone($organization->timezone)->format('d/m/Y H:i'),
            ]);
        }, 3);
    }

    /** Entrega e marcador do agendamento são confirmados na mesma transação, sem reaplicar receipt. @author André Narcizo */
    public function complete(string $id, string $organizationId, string $leaseToken, DeliveryReceipt $receipt): bool
    {
        abort_unless(preg_match('/^[A-Za-z0-9_.:-]{1,200}$/D', $receipt->providerMessageId), 502, 'Recibo de entrega inválido.');

        return DB::transaction(function () use ($id, $organizationId, $leaseToken, $receipt): bool {
            DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$organizationId]);
            $candidate = DB::table('message_deliveries')->where('organization_id', $organizationId)->where('id', $id)->first();
            if (! $candidate) {
                return false;
            }
            Appointment::where('organization_id', $organizationId)->whereKey($candidate->appointment_id)->lockForUpdate()->first();
            $delivery = DB::table('message_deliveries')->where('organization_id', $organizationId)->where('id', $id)->lockForUpdate()->first();
            if (! $this->ownsLease($delivery, $leaseToken) || ! $delivery->dispatch_started_at) {
                return false;
            }
            DB::table('message_deliveries')->where('id', $id)->update(['status' => 'sent', 'sent_at' => now(), 'provider_message_id' => $receipt->providerMessageId, 'lease_token' => null, 'lease_expires_at' => null, 'error_code' => null, 'updated_at' => now()]);
            DB::table('appointments')->where('organization_id', $organizationId)->where('id', $delivery->appointment_id)->where('status', 'confirmed')->where('start_time', $delivery->appointment_start_time)->update(['reminder_sent_at' => now(), 'updated_at' => now()]);

            return true;
        }, 3);
    }

    private function fail(string $id, string $organizationId, string $leaseToken, bool $uncertain): bool
    {
        return DB::transaction(function () use ($id, $organizationId, $leaseToken, $uncertain): bool {
            $delivery = DB::table('message_deliveries')->where('organization_id', $organizationId)->where('id', $id)->lockForUpdate()->first();
            if (! $this->ownsLease($delivery, $leaseToken)) {
                return false;
            }
            $this->updateState($id, $uncertain ? 'unknown' : 'failed', $uncertain ? 'provider_delivery_uncertain' : 'provider_rejected', now()->addSeconds(min(3600, 60 * (2 ** min(6, $delivery->attempts)))));

            return true;
        }, 3);
    }

    private function ownsLease(?object $delivery, string $token): bool
    {
        return $delivery && $delivery->status === 'processing' && is_string($delivery->lease_token)
            && hash_equals($delivery->lease_token, $token) && $delivery->lease_expires_at && CarbonImmutable::parse($delivery->lease_expires_at)->isFuture();
    }

    private function updateState(string $id, string $status, string $errorCode, mixed $nextAttempt = null): void
    {
        $updates = ['status' => $status, 'error_code' => $errorCode, 'lease_token' => null, 'lease_expires_at' => null, 'updated_at' => now()];
        if ($nextAttempt) {
            $updates['next_attempt_at'] = $nextAttempt;
        }
        DB::table('message_deliveries')->where('id', $id)->update($updates);
    }
}
