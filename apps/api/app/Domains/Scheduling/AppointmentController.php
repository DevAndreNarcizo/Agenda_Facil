<?php

declare(strict_types=1);

namespace App\Domains\Scheduling;

use App\Domains\Audit\Audit;
use App\Domains\Notifications\Services\OutboxService;
use App\Domains\Professionals\Models\Professional;
use App\Domains\Scheduling\Actions\BookAppointment;
use App\Domains\Scheduling\Models\Appointment;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AppointmentController
{
    public function index(Request $request): JsonResponse
    {
        $input = $request->validate(['start' => 'sometimes|date', 'end' => 'sometimes|date|after:start']);
        $query = Appointment::where('organization_id', $request->attributes->get('organization')->id)->with(['service', 'professional', 'customer']);
        if (isset($input['start'])) {
            $query->where('start_time', '>=', $input['start']);
        }
        if (isset($input['end'])) {
            $query->where('start_time', '<', $input['end']);
        }

        return response()->json(['data' => $query->orderBy('start_time')->limit(500)->get()]);
    }

    public function store(Request $request, BookAppointment $action): JsonResponse
    {
        $input = $request->validate($this->rules());
        $this->canManage($request, $input['professional_id']);
        $appointment = $action->execute($request->attributes->get('organization'), $input, $request->user()->id, $this->key($request));

        return response()->json(['data' => $appointment->load(['service', 'professional', 'customer'])], 201);
    }

    /** Reagenda com a mesma validação de disponibilidade e restringe transições. @author André Narcizo */
    public function update(Request $request, string $id, BookAppointment $action): JsonResponse
    {
        $input = $request->validate(['status' => 'sometimes|required|in:confirmed,completed,cancelled,no_show', 'start_time' => ['sometimes', 'required', 'date', 'regex:/T.+(?:Z|[+-]\d{2}:\d{2})$/'], 'organization_id' => 'prohibited', 'price_cents' => 'prohibited', 'service_id' => 'prohibited', 'professional_id' => 'prohibited', 'customer_id' => 'prohibited']);
        $organization = $request->attributes->get('organization');
        $appointment = DB::transaction(function () use ($id, $input, $organization, $action, $request) {
            DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$organization->id]);
            $appointment = Appointment::where('organization_id', $organization->id)->lockForUpdate()->findOrFail($id);
            $this->canManage($request, $appointment->professional_id);
            $allowed = ['pending' => ['confirmed', 'cancelled'], 'confirmed' => ['completed', 'cancelled', 'no_show']];
            if (isset($input['status']) && $input['status'] !== $appointment->status && ! in_array($input['status'], $allowed[$appointment->status] ?? [], true)) {
                throw ValidationException::withMessages(['status' => 'Transição de status inválida.']);
            }
            if (isset($input['start_time'])) {
                abort_unless(in_array($appointment->status, ['pending', 'confirmed'], true), 409, 'Agendamento encerrado não pode ser reagendado.');
                $start = CarbonImmutable::parse($input['start_time'])->utc();
                $duration = $appointment->start_time->diffInMinutes($appointment->end_time);
                $end = $start->addMinutes((int) $duration);
                $action->assertAvailable($organization, $appointment->professional_id, $start, $end, $appointment->id);
                $appointment->start_time = $start;
                $appointment->end_time = $end;
            }
            if (isset($input['status'])) {
                $appointment->status = $input['status'];
            }
            $appointment->save();
            app(OutboxService::class)->synchronize($appointment);
            Audit::record($organization->id, $request->user()->id, 'appointment.updated', $appointment->id);

            return $appointment;
        });

        return response()->json(['data' => $appointment->load(['service', 'professional', 'customer'])]);
    }

    private function canManage(Request $request, string $professionalId): void
    {
        $membership = $request->attributes->get('membership');
        if (in_array($membership->role, ['owner', 'admin'], true)) {
            return;
        }
        abort_unless(Professional::where('organization_id', $membership->organization_id)->where('membership_id', $membership->id)->where('is_active', true)->whereKey($professionalId)->exists(), 403, 'Funcionários só podem gerenciar a própria agenda.');
    }

    private function rules(): array
    {
        return ['service_id' => 'required|uuid', 'professional_id' => 'required|uuid', 'customer_id' => 'required|uuid', 'start_time' => ['required', 'date', 'regex:/T.+(?:Z|[+-]\d{2}:\d{2})$/'], 'organization_id' => 'prohibited', 'price_cents' => 'prohibited', 'status' => 'prohibited'];
    }

    private function key(Request $request): ?string
    {
        $key = $request->header('Idempotency-Key');
        abort_if($key !== null && ! preg_match('/^[A-Za-z0-9_-]{16,128}$/', $key), 422, 'Chave de idempotência inválida.');

        return $key;
    }
}
