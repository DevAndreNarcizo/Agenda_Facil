<?php

declare(strict_types=1);

namespace App\Domains\PublicBooking;

use App\Domains\Notifications\Services\OutboxService;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Professionals\Models\Professional;
use App\Domains\Scheduling\Actions\BookAppointment;
use App\Domains\Scheduling\Models\Appointment;
use App\Domains\Services\Models\Service;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class PublicBookingController
{
    private function organization(string $slug): Organization
    {
        return Organization::where('slug', $slug)->where('public_booking_enabled', true)->firstOrFail();
    }

    public function context(string $slug): JsonResponse
    {
        $organization = $this->organization($slug);

        return response()->json(['data' => ['organization' => $organization->only(['name', 'slug', 'timezone', 'primary_color', 'logo_url']), 'services' => Service::where('organization_id', $organization->id)->where('is_active', true)->get(['id', 'name', 'duration_minutes', 'price_cents']), 'professionals' => Professional::where('organization_id', $organization->id)->where('is_active', true)->get(['id', 'name'])]]);
    }

    /** Recebe cadastro mínimo de um cliente novo sem expor clientes já existentes. @author André Narcizo */
    public function book(Request $request, string $slug, BookAppointment $action): JsonResponse
    {
        $input = $request->validate(['service_id' => 'required|uuid', 'professional_id' => 'required|uuid', 'start_time' => ['required', 'date', 'regex:/T.+(?:Z|[+-]\d{2}:\d{2})$/'], 'customer' => 'required|array:name,email,phone', 'customer.name' => 'required|string|min:2|max:120', 'customer.email' => 'nullable|email:rfc|max:255', 'customer.phone' => 'nullable|string|regex:/^\+?[0-9 ()-]{10,30}$/', 'organization_id' => 'prohibited', 'customer_id' => 'prohibited', 'price_cents' => 'prohibited', 'status' => 'prohibited']);
        $customer = $input['customer'];
        unset($input['customer']);
        $key = $request->header('Idempotency-Key');
        abort_if($key !== null && ! preg_match('/^[A-Za-z0-9_-]{16,128}$/', $key), 422, 'Chave de idempotência inválida.');
        $appointment = $action->execute($this->organization($slug), $input, null, $key, $customer);
        $token = $appointment->issuedCancellationToken;

        return response()->json(['data' => [...$appointment->only(['id', 'start_time', 'end_time', 'status']), 'cancellation_token' => $token]], 201);
    }

    /** Lista somente slots sem dados pessoais; criação revalida sob lock. @author André Narcizo */
    public function availability(Request $request, string $slug, BookAppointment $action): JsonResponse
    {
        $input = $request->validate(['service_id' => 'required|uuid', 'professional_id' => 'required|uuid', 'date' => 'required|date_format:Y-m-d']);
        $organization = $this->organization($slug);
        $service = Service::where('organization_id', $organization->id)->where('is_active', true)->findOrFail($input['service_id']);
        Professional::where('organization_id', $organization->id)->where('is_active', true)->findOrFail($input['professional_id']);
        $day = CarbonImmutable::parse($input['date'], $organization->timezone)->startOfDay();
        abort_if($day->lessThan(CarbonImmutable::now($organization->timezone)->startOfDay()) || $day->greaterThan(now()->addDays(90)), 422, 'Data fora do período permitido.');
        $hours = DB::table('business_hours')->where('organization_id', $organization->id)->where('day_of_week', $day->dayOfWeek)->where('is_active', true)->first();
        $slots = [];
        if ($hours) {
            $cursor = CarbonImmutable::parse($input['date'].' '.$hours->start_time, $organization->timezone);
            $end = CarbonImmutable::parse($input['date'].' '.$hours->end_time, $organization->timezone);
            while ($cursor->addMinutes($service->duration_minutes)->lessThanOrEqualTo($end)) {
                try {
                    $action->assertAvailable($organization, $input['professional_id'], $cursor->utc(), $cursor->addMinutes($service->duration_minutes)->utc());
                    $slots[] = $cursor->utc()->toIso8601String();
                } catch (ValidationException) {
                    // Instantes passados não são oferecidos.
                } catch (HttpException $exception) {
                    if ($exception->getStatusCode() !== 409) {
                        throw $exception;
                    }
                }
                $cursor = $cursor->addMinutes(30);
            }
        }

        return response()->json(['data' => $slots]);
    }

    public function cancel(Request $request, string $slug, string $id): JsonResponse
    {
        $input = $request->validate(['token' => 'required|string|size:64']);
        $organization = $this->organization($slug);
        DB::transaction(function () use ($organization, $id, $input): void {
            DB::select('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$organization->id]);
            $appointment = Appointment::where('organization_id', $organization->id)->lockForUpdate()->findOrFail($id);
            abort_unless($appointment->cancellation_token_hash && hash_equals($appointment->cancellation_token_hash, hash('sha256', $input['token'])), 404);
            abort_unless(in_array($appointment->status, ['pending', 'confirmed', 'cancelled'], true), 409, 'Agendamento já encerrado.');
            $appointment->update(['status' => 'cancelled']);
            app(OutboxService::class)->synchronize($appointment);
        });

        return response()->json(['data' => ['status' => 'cancelled']]);
    }
}
