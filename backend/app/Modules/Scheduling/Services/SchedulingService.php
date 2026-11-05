<?php

declare(strict_types=1);

namespace Modules\Scheduling\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Billing\Services\EntitlementService;
use Modules\Organizations\Models\Organization;
use Modules\Scheduling\DataObjects\BookingRequest;
use Modules\Scheduling\Enums\AppointmentStatus;
use Modules\Scheduling\Exceptions\SchedulingConflictException;
use Modules\Scheduling\Models\Appointment;

/**
 * Comandos de agenda no servidor (SPEC-004 / ADR-006). Garante:
 *  - ausência de sobreposição para o mesmo profissional (lock + verificação + constraint EXCLUDE);
 *  - consumo transacional da cota mensal de agendamentos do plano;
 *  - transições de status consistentes.
 *
 * O servidor é a autoridade — o navegador não cria agendamentos diretamente.
 */
final class SchedulingService
{
    public function __construct(private readonly EntitlementService $entitlements) {}

    /**
     * Cria um agendamento de forma transacional e sem sobreposição.
     */
    public function book(Organization $organization, BookingRequest $request): Appointment
    {
        if ($request->end->lessThanOrEqualTo($request->start)) {
            throw new SchedulingConflictException('Intervalo inválido: término deve ser após o início.');
        }

        return DB::transaction(function () use ($organization, $request): Appointment {
            // Serializa criações concorrentes do mesmo profissional (lock consultivo por chave).
            $this->lockProfessional($organization->id, $request->professionalId);

            if ($this->hasOverlap($organization->id, $request->professionalId, $request->start, $request->end, null)) {
                throw new SchedulingConflictException('Já existe um agendamento nesse horário para este profissional.');
            }

            // Cota mensal do plano (não conta bloqueios de horário).
            if (! $request->isBlock) {
                $this->entitlements->consumeMonthly(
                    $organization,
                    EntitlementService::MONTHLY_APPOINTMENTS,
                    1,
                    $request->start,
                );
            }

            return Appointment::create([
                'organization_id' => $organization->id,
                'service_id' => $request->serviceId,
                'professional_id' => $request->professionalId,
                'customer_id' => $request->customerId,
                'start_time' => $request->start,
                'end_time' => $request->end,
                'status' => $request->isBlock ? AppointmentStatus::Confirmed->value : AppointmentStatus::Pending->value,
                'booking_source' => $request->source,
                'is_blocked' => $request->isBlock,
            ]);
        });
    }

    /**
     * Remarca um agendamento existente verificando sobreposição (exceto ele mesmo).
     */
    public function reschedule(Appointment $appointment, Carbon $start, Carbon $end): Appointment
    {
        if ($end->lessThanOrEqualTo($start)) {
            throw new SchedulingConflictException('Intervalo inválido.');
        }

        return DB::transaction(function () use ($appointment, $start, $end): Appointment {
            $this->lockProfessional($appointment->organization_id, $appointment->professional_id);

            if ($this->hasOverlap($appointment->organization_id, $appointment->professional_id, $start, $end, $appointment->id)) {
                throw new SchedulingConflictException('Conflito de horário na remarcação.');
            }

            $appointment->update(['start_time' => $start, 'end_time' => $end]);

            return $appointment;
        });
    }

    /**
     * Atualiza o status do agendamento (confirmar/concluir/cancelar).
     */
    public function changeStatus(Appointment $appointment, AppointmentStatus $status): Appointment
    {
        $appointment->update(['status' => $status->value]);

        return $appointment;
    }

    /**
     * Há sobreposição ativa para o profissional neste intervalo? (exclui $ignoreId)
     */
    public function hasOverlap(string $organizationId, ?string $professionalId, Carbon $start, Carbon $end, ?string $ignoreId): bool
    {
        if ($professionalId === null) {
            return false;
        }

        return Appointment::query()
            ->where('organization_id', $organizationId)
            ->where('professional_id', $professionalId)
            ->whereNot('status', AppointmentStatus::Cancelled->value)
            ->when($ignoreId !== null, fn ($q) => $q->whereKeyNot($ignoreId))
            // Interseção de intervalos: start < other.end AND end > other.start
            ->where('start_time', '<', $end)
            ->where('end_time', '>', $start)
            ->exists();
    }

    /**
     * Lock consultivo por profissional para serializar criações concorrentes.
     * PostgreSQL: advisory lock transacional; demais drivers: no-op (o teste cobre a regra lógica).
     */
    private function lockProfessional(string $organizationId, ?string $professionalId): void
    {
        if ($professionalId === null) {
            return;
        }

        if (DB::connection()->getDriverName() === 'pgsql') {
            $key = crc32($organizationId.'|'.$professionalId);
            DB::statement('SELECT pg_advisory_xact_lock(?)', [$key]);
        }
    }
}
