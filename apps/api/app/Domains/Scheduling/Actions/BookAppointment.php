<?php

declare(strict_types=1);

namespace App\Domains\Scheduling\Actions;

use App\Domains\Audit\Audit;
use App\Domains\Billing\Services\EntitlementService;
use App\Domains\Customers\Models\Customer;
use App\Domains\Notifications\Services\OutboxService;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Professionals\Models\Professional;
use App\Domains\Scheduling\Models\Appointment;
use App\Domains\Services\Models\Service;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class BookAppointment
{
    /** Reserva interna e pública compartilham transação, cota e exclusão de horários. @author André Narcizo */
    public function execute(Organization $organization, array $input, ?string $actorId = null, ?string $idempotencyKey = null, ?array $newCustomer = null): Appointment
    {
        try {
            return DB::transaction(function () use ($organization, $input, $actorId, $idempotencyKey, $newCustomer): Appointment {
                DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$organization->id]);
                $hash = hash('sha256', json_encode([$input, $newCustomer], JSON_THROW_ON_ERROR));
                if ($idempotencyKey) {
                    $existing = Appointment::where('organization_id', $organization->id)->where('idempotency_key', $idempotencyKey)->first();
                    if ($existing) {
                        abort_unless(hash_equals((string) $existing->request_hash, $hash), 409, 'Chave de idempotência já usada para outra reserva.');

                        return $existing;
                    }
                }
                $service = Service::where('organization_id', $organization->id)->where('is_active', true)->findOrFail($input['service_id']);
                Professional::where('organization_id', $organization->id)->where('is_active', true)->findOrFail($input['professional_id']);
                $start = CarbonImmutable::parse($input['start_time'])->utc();
                $end = $start->addMinutes($service->duration_minutes);
                $this->assertAvailable($organization, $input['professional_id'], $start, $end);
                app(EntitlementService::class)->assertCanCreate($organization->id, 'appointments');
                if ($newCustomer !== null) {
                    $customer = new Customer($newCustomer);
                    $customer->organization_id = $organization->id;
                    $customer->save();
                } else {
                    $customer = Customer::where('organization_id', $organization->id)->findOrFail($input['customer_id']);
                }
                $cancellationToken = $newCustomer ? Str::random(64) : null;
                $appointment = Appointment::create([
                    'organization_id' => $organization->id, 'service_id' => $service->id,
                    'professional_id' => $input['professional_id'], 'customer_id' => $customer->id,
                    'start_time' => $start, 'end_time' => $end, 'price_cents' => $service->price_cents,
                    'status' => 'pending', 'booking_source' => $newCustomer ? 'public' : 'direct',
                    'idempotency_key' => $idempotencyKey, 'request_hash' => $hash,
                    'cancellation_token_hash' => $cancellationToken ? hash('sha256', $cancellationToken) : null,
                ]);
                $appointment->issuedCancellationToken = $cancellationToken;
                app(EntitlementService::class)->consume($organization->id, 'appointments');
                Audit::record($organization->id, $actorId, 'appointment.created', $appointment->id);
                app(OutboxService::class)->synchronize($appointment);

                return $appointment;
            }, 3);
        } catch (QueryException $exception) {
            if ($exception->getCode() === '23P01') {
                abort(409, 'Este horário não está disponível.');
            }
            throw $exception;
        }
    }

    /** Valida instante, expediente IANA e conflitos; o banco também impede sobreposição. @author André Narcizo */
    public function assertAvailable(Organization $organization, string $professionalId, CarbonImmutable $start, CarbonImmutable $end, ?string $exceptId = null): void
    {
        $local = $start->setTimezone($organization->timezone);
        $localEnd = $end->setTimezone($organization->timezone);
        if ($start->isPast() || $start->greaterThan(now()->addDays(90)) || $local->toDateString() !== $localEnd->toDateString()) {
            throw ValidationException::withMessages(['start_time' => 'Escolha um horário futuro nos próximos 90 dias, no mesmo dia operacional.']);
        }
        $hours = DB::table('business_hours')->where('organization_id', $organization->id)->where('day_of_week', $local->dayOfWeek)->where('is_active', true)->first();
        if (! $hours || $local->format('H:i:s') < $hours->start_time || $localEnd->format('H:i:s') > $hours->end_time) {
            throw ValidationException::withMessages(['start_time' => 'Horário fora do expediente configurado.']);
        }
        $conflict = Appointment::where('organization_id', $organization->id)->where('professional_id', $professionalId)->whereIn('status', ['pending', 'confirmed', 'completed'])->where('start_time', '<', $end)->where('end_time', '>', $start)->when($exceptId, fn ($query) => $query->where('id', '!=', $exceptId))->exists();
        abort_if($conflict, 409, 'Este horário não está disponível.');
        $blocked = DB::table('appointment_blocks')->where('organization_id', $organization->id)
            ->where(fn ($query) => $query->whereNull('professional_id')->orWhere('professional_id', $professionalId))
            ->where('start_time', '<', $end)->where('end_time', '>', $start)->exists();
        abort_if($blocked, 409, 'Este horário está bloqueado.');
    }
}
