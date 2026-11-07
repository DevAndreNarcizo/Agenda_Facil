<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Scheduling;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Modules\Organizations\Services\TenantContext;
use Modules\Scheduling\DataObjects\BookingRequest;
use Modules\Scheduling\Enums\AppointmentStatus;
use Modules\Scheduling\Models\Appointment;
use Modules\Scheduling\Services\SchedulingService;

/**
 * Agenda operacional. Todas as mutações passam pelo SchedulingService (autoridade no servidor).
 */
final class AppointmentController extends Controller
{
    public function __construct(
        private readonly TenantContext $tenant,
        private readonly SchedulingService $scheduling,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $organization = $this->tenant->organization();

        $from = $request->date('from') ?? Carbon::now()->startOfDay();
        $to = $request->date('to') ?? Carbon::now()->endOfDay();

        $appointments = Appointment::query()
            ->where('organization_id', $organization->id)
            ->whereBetween('start_time', [$from, $to])
            ->orderBy('start_time')
            ->get();

        return response()->json(['data' => $appointments]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'service_id' => ['nullable', 'uuid'],
            'professional_id' => ['nullable', 'uuid'],
            'customer_id' => ['nullable', 'uuid'],
            'start_time' => ['required', 'date'],
            'end_time' => ['required', 'date', 'after:start_time'],
            'source' => ['nullable', 'in:direct,instagram,google,qr,site,referral'],
        ]);

        $appointment = $this->scheduling->book($this->tenant->organization(), new BookingRequest(
            serviceId: $data['service_id'] ?? null,
            professionalId: $data['professional_id'] ?? null,
            customerId: $data['customer_id'] ?? null,
            start: Carbon::parse($data['start_time']),
            end: Carbon::parse($data['end_time']),
            source: $data['source'] ?? 'direct',
        ));

        return response()->json(['data' => $appointment], 201);
    }

    public function reschedule(Request $request, string $appointment): JsonResponse
    {
        $data = $request->validate([
            'start_time' => ['required', 'date'],
            'end_time' => ['required', 'date', 'after:start_time'],
        ]);

        $model = $this->findInTenant($appointment);
        $updated = $this->scheduling->reschedule($model, Carbon::parse($data['start_time']), Carbon::parse($data['end_time']));

        return response()->json(['data' => $updated]);
    }

    public function updateStatus(Request $request, string $appointment): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:pending,confirmed,completed,cancelled'],
        ]);

        Log::info('CTRL_UPDATE_STATUS', [
            'ctx_org' => $this->tenant->organization()->id,
            'appt' => $appointment,
        ]);
        $model = $this->findInTenant($appointment);
        $updated = $this->scheduling->changeStatus($model, AppointmentStatus::from($data['status']));

        return response()->json(['data' => $updated]);
    }

    /**
     * Carrega o agendamento garantindo que pertence ao tenant atual (anti-IDOR/BOLA).
     */
    private function findInTenant(string $id): Appointment
    {
        return Appointment::query()
            ->where('organization_id', $this->tenant->organization()->id)
            ->whereKey($id)
            ->firstOrFail();
    }
}
