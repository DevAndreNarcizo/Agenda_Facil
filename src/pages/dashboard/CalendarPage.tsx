import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAppointments } from "@/hooks/use-appointments";
import { useEmployees } from "@/hooks/use-employees";
import { useServices } from "@/hooks/use-services";
import { getAgendaWindow, useBusinessHours } from "@/hooks/use-business-hours";
import { ConfirmDialog } from "@/components/panel/confirm-dialog";
import { Icon, Page, PageHeader, PanelButton, Segmented, ToolbarSelect } from "@/components/panel/primitives";
import { normalizeAppointmentFilters, type AppointmentView } from "@/lib/appointment-filters";
import { ACTIVE_STATUSES, STATUS_META } from "@/lib/appointment-status";
import {
  addDaysToKey, formatDateKey, getZonedParts, mondayOfWeek, todayKey, zonedDateTimeToUtc,
} from "@/lib/agenda-time";
import { buildAgendaItems, type AgendaItem } from "./calendar/agenda-model";
import { AppointmentPanel } from "./calendar/AppointmentPanel";
import { AppointmentDialog, type AppointmentDraft } from "./calendar/AppointmentDialog";
import { BlockDialog, type BlockDraft } from "./calendar/BlockDialog";
import { MonthGrid } from "./calendar/MonthGrid";
import { WeekGrid } from "./calendar/WeekGrid";

/** A grade carrega o período inteiro de uma vez (limite máximo aceito pelos filtros). */
const AGENDA_PAGE_SIZE = 100;

/**
 * Título do período exibido: "21 – 27 de setembro", "Sexta, 25 de setembro" ou "Setembro de 2026".
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function periodTitle(view: AppointmentView, dateKey: string): string {
  if (view === "day") return formatDateKey(dateKey, { weekday: "long", day: "numeric", month: "long" });
  if (view === "month") return formatDateKey(dateKey, { month: "long", year: "numeric" });
  const start = mondayOfWeek(dateKey);
  const end = addDaysToKey(start, 6);
  return start.slice(5, 7) === end.slice(5, 7)
    ? `${Number(start.slice(8))} – ${formatDateKey(end, { day: "numeric", month: "long" })}`
    : `${formatDateKey(start, { day: "numeric", month: "short" })} – ${formatDateKey(end, { day: "numeric", month: "short" })}`;
}

/**
 * Desloca a data de referência conforme a visão (dia, semana ou mês).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function shiftDate(view: AppointmentView, dateKey: string, direction: 1 | -1): string {
  if (view === "day") return addDaysToKey(dateKey, direction);
  if (view === "week") return addDaysToKey(dateKey, 7 * direction);
  const [year, month] = dateKey.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + direction, 1, 12));
  return target.toISOString().slice(0, 10);
}

/**
 * Próximo horário cheio ou meia hora a partir de agora (para "Novo agendamento" sem slot).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function nextHalfHour(): number {
  const { minutes } = getZonedParts(new Date());
  return Math.min(23 * 60, Math.ceil((minutes + 1) / 30) * 30);
}

/**
 * Agenda do painel: grade própria (dia/semana/mês), detalhe lateral sem modal,
 * clique em horário vazio para agendar e bloqueios — tudo via Edge Function autorizada.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => ({ ...normalizeAppointmentFilters(searchParams), page: 1, pageSize: AGENDA_PAGE_SIZE }),
    [searchParams],
  );
  const {
    appointments, blocks, totalAppointments, loading, error,
    createAppointment, rescheduleAppointment, updateAppointmentStatus, cancelAppointment,
    createAppointmentBlock, deleteAppointmentBlock,
    creating, rescheduling, updatingStatus, cancelling, changingBlock,
  } = useAppointments(filters);
  const { employees } = useEmployees();
  const { services } = useServices();
  const { days: businessDays } = useBusinessHours();

  const [appointmentDraft, setAppointmentDraft] = useState<AppointmentDraft | null>(null);
  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);
  const [pendingCancel, setPendingCancel] = useState<AgendaItem | null>(null);

  const visibleStatuses = filters.statuses.length > 0 ? filters.statuses : ACTIVE_STATUSES;
  const items = useMemo(() => buildAgendaItems(appointments, blocks, visibleStatuses), [appointments, blocks, visibleStatuses]);
  // Conflitos consideram tudo que está ativo, mesmo que o filtro de status esconda.
  const conflictItems = useMemo(() => buildAgendaItems(appointments, blocks, ACTIVE_STATUSES), [appointments, blocks]);

  const selectedKey = searchParams.get("appointment")
    ? `a:${searchParams.get("appointment")}`
    : searchParams.get("block") ? `b:${searchParams.get("block")}` : null;
  const selected = selectedKey ? items.find((item) => item.key === selectedKey) ?? null : null;

  const columns = filters.view === "day"
    ? [filters.date]
    : Array.from({ length: 7 }, (_, index) => addDaysToKey(mondayOfWeek(filters.date), index));
  const agendaWindow = useMemo(() => {
    const base = getAgendaWindow(businessDays);
    // Expande a janela se houver itens fora do expediente (ex.: encaixe às 7h).
    const visible = items.filter((item) => columns.includes(item.dateKey));
    const start = Math.min(base.start, ...visible.map((item) => Math.floor(item.startMin / 60) * 60));
    const end = Math.max(base.end, ...visible.map((item) => Math.ceil(item.endMin / 60) * 60));
    return { start, end: Math.min(24 * 60, end) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- columns deriva de filters.
  }, [businessDays, items, filters.date, filters.view]);

  /**
   * Atualiza parâmetros de URL mantendo a agenda compartilhável.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const updateParams = (changes: Record<string, string | null>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(changes).forEach(([key, value]) => (value === null || value === "" ? next.delete(key) : next.set(key, value)));
      next.delete("page");
      next.delete("pageSize");
      return next;
    }, { replace: true });
  };

  const selectItem = (item: AgendaItem | null) => updateParams({
    appointment: item?.kind === "appointment" ? item.appointment?.id ?? null : null,
    block: item?.kind === "block" ? item.block?.id ?? null : null,
  });

  /**
   * Abre o modal de novo agendamento com dia e hora preenchidos.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const openCreate = (dateKey: string, startMin: number) => {
    const activeServices = services.filter((service) => service.is_active);
    setAppointmentDraft({
      dateKey,
      startMin,
      serviceId: activeServices[0]?.id ?? "",
      employeeId: filters.employeeId ?? employees[0]?.id ?? "",
      customerName: "",
      customerPhone: "",
      notes: "",
    });
  };

  // "Novo agendamento" do cabeçalho chega como ?new=1.
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const today = todayKey();
    openCreate(filters.date, filters.date === today ? nextHalfHour() : 9 * 60);
    updateParams({ new: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara apenas pelo parâmetro.
  }, [searchParams]);

  /**
   * Executa uma ação da agenda com feedback padronizado de sucesso/erro.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const run = async (action: () => Promise<unknown>, success: string, fallback: string): Promise<boolean> => {
    try {
      await action();
      toast.success(success);
      return true;
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : fallback);
      return false;
    }
  };

  /**
   * Cria ou reagenda; a duração e a disponibilidade final são validadas no servidor.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const submitAppointment = async (draft: AppointmentDraft) => {
    const startTime = zonedDateTimeToUtc(draft.dateKey, draft.startMin).toISOString();
    const ok = draft.appointmentId
      ? await run(
          () => rescheduleAppointment({ appointmentId: draft.appointmentId as string, employeeId: draft.employeeId || null, serviceId: draft.serviceId, startTime }),
          "Agendamento reagendado.",
          "Não foi possível reagendar.",
        )
      : await run(
          () => createAppointment({
            customerName: draft.customerName.trim(),
            customerPhone: draft.customerPhone.trim() || null,
            employeeId: draft.employeeId || null,
            notes: draft.notes.trim() || null,
            serviceId: draft.serviceId,
            startTime,
          }),
          `Agendamento criado para ${draft.customerName.trim().split(" ")[0]}.`,
          "Não foi possível criar o agendamento.",
        );
    if (!ok) return;
    setAppointmentDraft(null);
    if (draft.dateKey !== filters.date && !columns.includes(draft.dateKey)) updateParams({ date: draft.dateKey });
  };

  const submitBlock = async (draft: BlockDraft) => {
    const ok = await run(
      () => createAppointmentBlock({
        employeeId: draft.employeeId || null,
        startTime: zonedDateTimeToUtc(draft.dateKey, draft.startMin).toISOString(),
        endTime: zonedDateTimeToUtc(draft.dateKey, draft.endMin).toISOString(),
        reason: draft.reason.trim() || null,
      }),
      "Bloqueio criado.",
      "Não foi possível criar o bloqueio.",
    );
    if (ok) setBlockDraft(null);
  };

  const openReschedule = (item: AgendaItem) => {
    const appointment = item.appointment;
    if (!appointment) return;
    setAppointmentDraft({
      appointmentKey: item.key,
      appointmentId: appointment.id,
      dateKey: item.dateKey,
      startMin: item.startMin,
      serviceId: appointment.service_id,
      employeeId: appointment.employee_id ?? "",
      customerName: appointment.customer_name,
      customerPhone: appointment.customer_phone,
      notes: appointment.notes ?? "",
    });
  };

  const today = todayKey();
  const legend = (["confirmed", "pending", "completed", "block"] as const).map((status) => STATUS_META[status]);
  const truncated = totalAppointments > appointments.length;

  return (
    <Page>
      <PageHeader
        eyebrow="Agenda"
        title={<span className="inline-block first-letter:uppercase">{periodTitle(filters.view, filters.date)}</span>}
        actions={
          <PanelButton
            icon="block"
            onClick={() => setBlockDraft({ dateKey: filters.date, startMin: 12 * 60, endMin: 13 * 60, employeeId: filters.employeeId ?? "", reason: "" })}
          >
            Novo bloqueio
          </PanelButton>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-8 items-center rounded-lg border border-af-line bg-af-surface">
          <button type="button" aria-label="Período anterior" onClick={() => updateParams({ date: shiftDate(filters.view, filters.date, -1) })} className="flex h-full items-center px-1.5 text-af-ink2 hover:text-af-ink">
            <Icon name="chevron_left" />
          </button>
          <button
            type="button"
            onClick={() => updateParams({ date: today })}
            className="flex h-full items-center border-x border-af-line px-2 text-[13px] font-medium hover:bg-af-surface2"
          >
            Hoje
          </button>
          <button type="button" aria-label="Próximo período" onClick={() => updateParams({ date: shiftDate(filters.view, filters.date, 1) })} className="flex h-full items-center px-1.5 text-af-ink2 hover:text-af-ink">
            <Icon name="chevron_right" />
          </button>
        </div>
        <Segmented
          label="Visualização"
          value={filters.view}
          onChange={(view) => updateParams({ view })}
          options={[{ value: "day", label: "Dia" }, { value: "week", label: "Semana" }, { value: "month", label: "Mês" }]}
        />
        <div className="flex-1" />
        <ToolbarSelect
          label="Profissional"
          value={filters.employeeId ?? ""}
          onChange={(employee) => updateParams({ employee })}
          options={[{ value: "", label: "Toda a equipe" }, ...employees.map((employee) => ({ value: employee.id, label: employee.full_name }))]}
        />
        <ToolbarSelect
          label="Status"
          value={filters.statuses.join(",")}
          onChange={(status) => updateParams({ status })}
          options={[
            { value: "", label: "Ativos" },
            { value: "pending", label: "Pendentes" },
            { value: "confirmed", label: "Confirmados" },
            { value: "completed", label: "Concluídos" },
            { value: "cancelled", label: "Cancelados" },
          ]}
        />
      </div>

      {error && <p role="alert" className="m-0 rounded-af bg-af-bad-soft px-4 py-3 text-[13px] text-af-bad">{error}</p>}

      <div className="flex flex-wrap items-start gap-4 min-[720px]:flex-nowrap">
        <section aria-busy={loading} className="min-w-0 flex-1 overflow-x-auto rounded-af-lg border border-af-line bg-af-surface">
          {filters.view === "month" ? (
            <MonthGrid
              monthKey={filters.date}
              items={items}
              selectedKey={selectedKey}
              onSelect={selectItem}
              onOpenDay={(dateKey) => updateParams({ view: "day", date: dateKey })}
            />
          ) : (
            <WeekGrid
              days={columns}
              items={items}
              window={agendaWindow}
              businessDays={businessDays}
              selectedKey={selectedKey}
              onSelect={selectItem}
              onCreate={openCreate}
            />
          )}
        </section>

        {selected && (
          <AppointmentPanel
            key={selected.key}
            item={selected}
            employees={employees}
            busy={updatingStatus || cancelling || changingBlock}
            onClose={() => selectItem(null)}
            onConfirm={() => void run(() => updateAppointmentStatus(selected.appointment!.id, "confirmed"), "Agendamento confirmado.", "Não foi possível confirmar.")}
            onComplete={() => void run(() => updateAppointmentStatus(selected.appointment!.id, "completed"), "Atendimento concluído.", "Não foi possível concluir.")}
            onReschedule={() => openReschedule(selected)}
            onCancel={() => setPendingCancel(selected)}
            onRemoveBlock={() => setPendingCancel(selected)}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-5 text-xs text-af-ink2">
        {legend.map((meta) => (
          <span key={meta.label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-[3px] border ${meta.bg} ${meta.border}`} />
            {meta.label}
          </span>
        ))}
        {loading && <span className="text-af-ink3">Atualizando agenda…</span>}
        {truncated && <span className="text-af-pend">Mostrando os primeiros {appointments.length} de {totalAppointments} agendamentos do período. Filtre por profissional para ver todos.</span>}
      </div>

      {appointmentDraft && (
        <AppointmentDialog
          key={`${appointmentDraft.appointmentId ?? "new"}-${appointmentDraft.dateKey}-${appointmentDraft.startMin}`}
          draft={appointmentDraft}
          services={services}
          employees={employees}
          items={conflictItems}
          saving={creating || rescheduling}
          onClose={() => setAppointmentDraft(null)}
          onSubmit={(draft) => void submitAppointment(draft)}
        />
      )}

      {blockDraft && (
        <BlockDialog draft={blockDraft} employees={employees} saving={changingBlock} onClose={() => setBlockDraft(null)} onSubmit={(draft) => void submitBlock(draft)} />
      )}

      <ConfirmDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => !open && setPendingCancel(null)}
        title={pendingCancel?.kind === "block" ? "Remover bloqueio?" : "Cancelar agendamento?"}
        description={pendingCancel?.kind === "block" ? "O horário volta a ficar disponível para reservas." : "O horário é liberado e o cliente será avisado."}
        confirmLabel={pendingCancel?.kind === "block" ? "Remover bloqueio" : "Cancelar agendamento"}
        busy={cancelling || changingBlock}
        onConfirm={async () => {
          const item = pendingCancel;
          if (!item) return;
          const ok = item.kind === "block"
            ? await run(() => deleteAppointmentBlock(item.block!.id), "Bloqueio removido.", "Não foi possível remover o bloqueio.")
            : await run(() => cancelAppointment(item.appointment!.id), "Agendamento cancelado.", "Não foi possível cancelar.");
          if (ok) {
            setPendingCancel(null);
            selectItem(null);
          }
        }}
      />
    </Page>
  );
}
