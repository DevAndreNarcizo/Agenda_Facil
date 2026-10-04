import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useAppointments, type Appointment } from "@/hooks/use-appointments";
import { usePendingAppointments, useRecentActivity } from "@/hooks/use-dashboard-overview";
import { usePeriodSummary } from "@/hooks/use-period-summary";
import { normalizeAppointmentFilters } from "@/lib/appointment-filters";
import { useEmployees } from "@/hooks/use-employees";
import { useBusinessHours } from "@/hooks/use-business-hours";
import {
  EmptyState, Icon, InitialsAvatar, KpiStrip, Page, Panel, PanelHeader, Segmented, Skeleton, StatusDot,
} from "@/components/panel/primitives";
import { formatDateKey, formatInstant, formatMinutes, getZonedParts, todayKey } from "@/lib/agenda-time";
import { formatCurrency, formatRelativeShort, getInitials, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACTIVITY_BY_SOURCE: Record<string, string> = {
  direct: "agendou diretamente",
  site: "reservou pelo site",
  qr: "reservou pelo QR code",
  instagram: "reservou pelo Instagram",
  google: "reservou pelo Google",
  referral: "reservou por indicação",
};

/**
 * Saudação conforme o horário local de São Paulo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function greeting(minutes: number): string {
  if (minutes < 12 * 60) return "Bom dia";
  if (minutes < 18 * 60) return "Boa tarde";
  return "Boa noite";
}

/**
 * Duração do atendimento em minutos (fim − início).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function durationMinutes(appointment: Appointment): number {
  return Math.max(0, Math.round((new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) / 60_000));
}

/**
 * Formata o horário (HH:MM) de um instante ISO no fuso operacional.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function timeOf(iso: string): string {
  return formatInstant(iso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/**
 * Início do painel: métricas do dia, agenda por profissional, pendências e atividade recente.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function DashboardHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const today = todayKey();
  // Lista de hoje carregada por completo; KPIs, pendências e atividade vêm de consultas agregadas/limitadas.
  const todayFilters = useMemo(() => normalizeAppointmentFilters(new URLSearchParams(`view=day&date=${today}`)), [today]);
  const { appointments, loading: loadingApts, updateAppointmentStatus, updatingStatus } = useAppointments(todayFilters, { fetchAll: true });
  const { employees, loading: loadingEmps } = useEmployees();
  const { days } = useBusinessHours();
  const { summary: todaySummary } = usePeriodSummary(today, "day");
  const { summary: monthSummary } = usePeriodSummary(today, "month");
  const { pending, pendingTotal } = usePendingAppointments(5);
  const { recent } = useRecentActivity(4);

  const view = useMemo(() => {
    const now = new Date();
    const nowParts = getZonedParts(now);
    const todays = appointments
      .filter((appointment) => appointment.status !== "cancelled")
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const next = todays.find((appointment) => appointment.status !== "completed" && new Date(appointment.start_time) >= now);

    // Ocupação = minutos reservados hoje / (expediente de hoje × profissionais).
    const businessDay = days.find((day) => day.dayOfWeek === nowParts.weekday);
    const capacity = businessDay?.isActive ? (businessDay.end - businessDay.start) * Math.max(1, employees.length) : 0;
    const occupancy = capacity > 0 ? Math.min(100, Math.round((todaySummary.bookedMinutes / capacity) * 100)) : null;

    return { nowMinutes: nowParts.minutes, todays, next, occupancy };
  }, [appointments, days, employees.length, todaySummary.bookedMinutes]);

  /**
   * Confirma uma pendência direto do Início, pela Edge Function autorizada.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const confirm = async (appointment: Appointment) => {
    try {
      await updateAppointmentStatus(appointment.id, "confirmed");
      toast.success(`Agendamento de ${appointment.customer_name} confirmado.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível confirmar o agendamento.");
    }
  };

  /**
   * Abre o agendamento no painel lateral da Agenda.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const openInAgenda = (appointment: Appointment) => {
    const { dateKey } = getZonedParts(new Date(appointment.start_time));
    navigate(`/dashboard/calendar?date=${dateKey}&appointment=${appointment.id}`);
  };

  if (loadingApts || loadingEmps) {
    return (
      <Page>
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-[106px]" />
        <Skeleton className="h-[420px]" />
      </Page>
    );
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-none flex-col gap-1.5">
          <span className="text-[13px] text-af-ink3 first-letter:uppercase">{formatDateKey(today, { weekday: "long", day: "numeric", month: "long" })}</span>
          <h1 className="m-0 text-[28px] font-bold leading-[1.15] tracking-[-0.02em]">
            {greeting(view.nowMinutes)}{firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        {view.next && (
          <span className="text-[13px] text-af-ink2 [text-wrap:pretty]">
            Próximo atendimento às <strong className="font-semibold text-af-ink">{timeOf(view.next.start_time)}</strong> · {view.next.customer_name}
          </span>
        )}
      </div>

      <KpiStrip
        items={[
          { label: "Agendamentos hoje", value: todaySummary.total, sub: `${pendingTotal} aguardando confirmação` },
          { label: "Agendamentos no mês", value: monthSummary.total.toLocaleString("pt-BR"), sub: <span className="inline-block first-letter:uppercase">{formatDateKey(today, { month: "long", year: "numeric" })}</span> },
          { label: "Faturamento previsto", value: formatCurrency(monthSummary.paidRevenue, { compact: true }), sub: "Com base em agendamentos pagos" },
          { label: "Ocupação da agenda", value: view.occupancy === null ? "—" : `${view.occupancy}%`, sub: view.occupancy === null ? "Fechado hoje" : "Capacidade usada hoje" },
        ]}
      />

      <div className="flex flex-wrap items-start gap-5">
        <Panel className="min-w-0 flex-[2_1_560px] overflow-hidden">
          <PanelHeader
            title="Agenda de hoje"
            action={
              <Segmented
                label="Período"
                size="sm"
                value="today"
                onChange={(value) => value === "week" && navigate("/dashboard/calendar")}
                options={[{ value: "today", label: "Hoje" }, { value: "week", label: "Semana" }]}
              />
            }
          />
          {employees.length === 0 ? (
            <EmptyState icon="badge" title="Nenhum profissional cadastrado" description="Adicione a equipe em Profissionais para distribuir os atendimentos." />
          ) : (
            // Divisórias via box-shadow à direita/abaixo: a última coluna/linha é recortada pelo overflow,
            // evitando o bloco vazio que o gap-px deixava quando a última linha fica incompleta.
            <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
              {employees.map((employee) => {
                const items = view.todays.filter((appointment) => appointment.employee_id === employee.id);
                return (
                  <div key={employee.id} className="flex flex-col bg-af-surface [box-shadow:1px_0_0_var(--af-line),0_1px_0_var(--af-line)]">
                    <div className="flex items-center gap-2.5 px-4 py-3.5">
                      <InitialsAvatar initials={getInitials(employee.full_name)} size={28} muted />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[13px] font-medium">{employee.full_name}</span>
                        <span className="text-[11px] text-af-ink3">{plural(items.length, "atendimento")}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 px-3 pb-3.5">
                      {items.length === 0 && <span className="px-2.5 py-2 text-xs text-af-ink3">Sem atendimentos hoje</span>}
                      {items.map((appointment) => (
                        <button
                          key={appointment.id}
                          type="button"
                          onClick={() => openInAgenda(appointment)}
                          className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5 rounded-af p-2.5 text-left hover:bg-af-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-af-accent"
                        >
                          <span className="pt-px text-xs text-af-ink2">{timeOf(appointment.start_time)}</span>
                          <span className="flex min-w-0 flex-col gap-[3px]">
                            <span className={cn("truncate text-[13px] font-medium", appointment.status === "completed" ? "text-af-ink2" : "text-af-ink")}>
                              {appointment.customer_name}
                            </span>
                            <span className="truncate text-xs text-af-ink3">
                              {appointment.service?.name ?? "Serviço"} · {durationMinutes(appointment)} min
                            </span>
                            <StatusDot status={appointment.status} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <Panel>
            <PanelHeader title="A confirmar" action={<span className="whitespace-nowrap text-xs text-af-ink3">{plural(pendingTotal, "pendente")}</span>} />
            {pending.length === 0 ? (
              <p className="m-0 px-5 py-4 text-[13px] text-af-ink2">Nenhuma reserva aguardando confirmação.</p>
            ) : (
              pending.map((appointment) => {
                const parts = getZonedParts(new Date(appointment.start_time));
                const dayLabel = parts.dateKey === today ? "Hoje" : formatDateKey(parts.dateKey, { weekday: "short" });
                return (
                  <div key={appointment.id} className="flex items-center gap-3 border-t border-af-line px-5 py-3 first:border-t-0">
                    <button type="button" onClick={() => openInAgenda(appointment)} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                      <span className="truncate text-[13px] font-medium">{appointment.customer_name}</span>
                      <span className="truncate text-xs text-af-ink3 first-letter:uppercase">
                        {dayLabel}, {formatMinutes(parts.minutes)} · {appointment.service?.name ?? "Serviço"}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => void confirm(appointment)}
                      className="rounded-md border border-af-line2 px-2.5 py-[5px] text-xs font-medium hover:bg-af-surface2 disabled:opacity-45"
                    >
                      Confirmar
                    </button>
                  </div>
                );
              })
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Atividade recente" />
            {recent.length === 0 ? (
              <p className="m-0 px-5 py-4 text-[13px] text-af-ink2">As novas reservas aparecem aqui.</p>
            ) : (
              <div className="flex flex-col py-1.5">
                {recent.map((appointment) => {
                  const icon = appointment.status === "completed" ? "check_circle" : appointment.status === "cancelled" ? "event_busy" : "event_available";
                  const what = appointment.status === "completed"
                    ? "atendimento concluído"
                    : appointment.status === "cancelled"
                      ? "agendamento cancelado"
                      : ACTIVITY_BY_SOURCE[appointment.booking_source ?? "direct"] ?? ACTIVITY_BY_SOURCE.direct;
                  return (
                    <div key={appointment.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-2.5 px-5 py-[9px]">
                      <Icon name={icon} size={17} className="text-af-ink3" />
                      <span className="text-[13px] text-af-ink2 [text-wrap:pretty]">
                        <span className="font-medium text-af-ink">{appointment.customer_name}</span> {what}
                      </span>
                      <span className="whitespace-nowrap text-[11px] text-af-ink3">{appointment.created_at ? formatRelativeShort(appointment.created_at) : ""}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </Page>
  );
}
