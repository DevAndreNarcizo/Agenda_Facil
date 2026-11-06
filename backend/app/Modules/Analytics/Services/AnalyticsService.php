<?php

declare(strict_types=1);

namespace Modules\Analytics\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Organizations\Models\Organization;
use Modules\Scheduling\Enums\AppointmentStatus;

/**
 * Métricas agregadas por organização para o painel (SPEC-016, versão básica do MVP).
 * Tudo escopado por organization_id — nunca cruza tenants.
 */
final class AnalyticsService
{
    /**
     * Resumo do período (mês corrente por padrão): totais por status, faturamento estimado
     * (serviços de agendamentos concluídos) e série diária de agendamentos.
     *
     * @return array{
     *   period: array{from:string, to:string},
     *   totals: array{total:int, confirmed:int, completed:int, cancelled:int, pending:int},
     *   revenue_cents: int,
     *   by_day: list<array{date:string, count:int}>,
     *   top_services: list<array{name:string, count:int}>
     * }
     */
    public function summary(Organization $organization, ?Carbon $from = null, ?Carbon $to = null): array
    {
        $from ??= Carbon::now()->startOfMonth();
        $to ??= Carbon::now()->endOfMonth();

        // Colunas qualificadas com `appointments.` para evitar ambiguidade após joins com services.
        $base = DB::table('appointments')
            ->where('appointments.organization_id', $organization->id)
            ->where('appointments.is_blocked', false)
            ->whereBetween('appointments.start_time', [$from, $to]);

        $byStatus = (clone $base)
            ->select('appointments.status', DB::raw('count(*) as c'))
            ->groupBy('appointments.status')
            ->pluck('c', 'status');

        $totals = [
            'total' => (int) $byStatus->sum(),
            'confirmed' => (int) ($byStatus[AppointmentStatus::Confirmed->value] ?? 0),
            'completed' => (int) ($byStatus[AppointmentStatus::Completed->value] ?? 0),
            'cancelled' => (int) ($byStatus[AppointmentStatus::Cancelled->value] ?? 0),
            'pending' => (int) ($byStatus[AppointmentStatus::Pending->value] ?? 0),
        ];

        // Faturamento estimado: soma do preço do serviço dos agendamentos concluídos.
        $revenueCents = (int) (clone $base)
            ->where('appointments.status', AppointmentStatus::Completed->value)
            ->join('services', 'services.id', '=', 'appointments.service_id')
            ->sum('services.price_cents');

        // Série diária (não cancelados).
        $byDay = (clone $base)
            ->whereNot('appointments.status', AppointmentStatus::Cancelled->value)
            ->select(DB::raw('date(appointments.start_time) as d'), DB::raw('count(*) as c'))
            ->groupBy('d')
            ->orderBy('d')
            ->get()
            ->map(fn ($r) => ['date' => (string) $r->d, 'count' => (int) $r->c])
            ->all();

        // Serviços mais agendados (não cancelados).
        $topServices = (clone $base)
            ->whereNot('appointments.status', AppointmentStatus::Cancelled->value)
            ->join('services', 'services.id', '=', 'appointments.service_id')
            ->select('services.name', DB::raw('count(*) as c'))
            ->groupBy('services.name')
            ->orderByDesc('c')
            ->limit(5)
            ->get()
            ->map(fn ($r) => ['name' => (string) $r->name, 'count' => (int) $r->c])
            ->all();

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'totals' => $totals,
            'revenue_cents' => $revenueCents,
            'by_day' => $byDay,
            'top_services' => $topServices,
        ];
    }
}
