<?php

declare(strict_types=1);

namespace App\Domains\Analytics;

use App\Domains\Customers\Models\Customer;
use App\Domains\Professionals\Models\Professional;
use App\Domains\Scheduling\Models\Appointment;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class AnalyticsController
{
    public function dashboard(Request $request): JsonResponse
    {
        $organization = $request->attributes->get('organization');
        $today = CarbonImmutable::now($organization->timezone)->startOfDay();
        $base = Appointment::where('organization_id', $organization->id);

        return response()->json(['data' => ['appointments_today' => (clone $base)->where('start_time', '>=', $today->utc())->where('start_time', '<', $today->addDay()->utc())->where('status', '!=', 'cancelled')->count(), 'customers' => Customer::where('organization_id', $organization->id)->count(), 'professionals' => Professional::where('organization_id', $organization->id)->where('is_active', true)->count(), 'monthly_revenue_cents' => (int) (clone $base)->where('status', 'completed')->where('start_time', '>=', $today->startOfMonth()->utc())->sum('price_cents'), 'upcoming' => (clone $base)->with(['service', 'professional', 'customer'])->where('start_time', '>=', now())->whereIn('status', ['pending', 'confirmed'])->orderBy('start_time')->limit(10)->get()]]);
    }

    public function summary(Request $request): JsonResponse
    {
        $id = $request->attributes->get('organization')->id;
        $base = Appointment::where('organization_id', $id);
        $total = (clone $base)->count();
        $completed = (clone $base)->where('status', 'completed')->count();

        return response()->json(['data' => ['total_appointments' => $total, 'completed_appointments' => $completed, 'cancelled_appointments' => (clone $base)->where('status', 'cancelled')->count(), 'revenue_cents' => (int) (clone $base)->where('status', 'completed')->sum('price_cents'), 'completion_percent' => $total ? round($completed / $total * 100, 1) : 0, ...$this->occupancy($request)]]);
    }

    /** Ocupação agendada no mês local dividida pela capacidade dos profissionais ativos. @author André Narcizo */
    private function occupancy(Request $request): array
    {
        $organization = $request->attributes->get('organization');
        $month = CarbonImmutable::now($organization->timezone)->startOfMonth();
        $end = $month->addMonth();
        $hours = DB::table('business_hours')->where('organization_id', $organization->id)->where('is_active', true)->get()->keyBy('day_of_week');
        $capacity = 0;
        for ($day = $month; $day->lessThan($end); $day = $day->addDay()) {
            $hour = $hours->get($day->dayOfWeek);
            if ($hour) {
                $capacity += CarbonImmutable::parse($day->toDateString().' '.$hour->start_time, $organization->timezone)->diffInMinutes(CarbonImmutable::parse($day->toDateString().' '.$hour->end_time, $organization->timezone));
            }
        }
        $capacity *= Professional::where('organization_id', $organization->id)->where('is_active', true)->count();
        $booked = (float) DB::table('appointments')->where('organization_id', $organization->id)->whereIn('status', ['pending', 'confirmed', 'completed'])->where('start_time', '>=', $month->utc())->where('start_time', '<', $end->utc())->selectRaw('COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 60), 0) AS minutes')->value('minutes');

        return ['occupancy_percent' => $capacity > 0 ? round($booked / $capacity * 100, 1) : 0, 'capacity_minutes' => (int) $capacity, 'booked_minutes' => (int) $booked, 'occupancy_period' => $month->format('Y-m')];
    }

    /** Exportação só para administração, inclusive quando billing restringe novas escritas. @author André Narcizo */
    public function export(Request $request): JsonResponse
    {
        abort_unless(in_array($request->attributes->get('membership')->role, ['owner', 'admin'], true), 403);
        $id = $request->attributes->get('organization')->id;

        return response()->json(['data' => ['organization' => $request->attributes->get('organization'), 'customers' => Customer::where('organization_id', $id)->get(), 'appointments' => Appointment::where('organization_id', $id)->get(), 'exported_at' => now()->toIso8601String()]]);
    }
}
