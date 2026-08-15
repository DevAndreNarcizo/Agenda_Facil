import { type FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Calendar,
  dateFnsLocalizer,
  type Event as CalendarEvent,
  type SlotInfo,
} from "react-big-calendar";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  type Appointment,
  type AppointmentBlock,
  type AppointmentStatus,
  useAppointments,
} from "@/hooks/use-appointments";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import {
  normalizeAppointmentFilters,
  type AppointmentFilters,
} from "@/lib/appointment-filters";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "pt-BR": ptBR },
});

interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
}

interface AppointmentForm {
  appointmentId?: string;
  customerName: string;
  customerPhone: string;
  employeeId: string;
  notes: string;
  serviceId: string;
  startTime: Date;
}

interface BlockForm {
  employeeId: string;
  endTime: Date;
  reason: string;
  startTime: Date;
}

type AgendaEvent =
  | (CalendarEvent & {
      kind: "appointment";
      appointment: Appointment;
      resource: string | null;
    })
  | (CalendarEvent & {
      kind: "block";
      block: AppointmentBlock;
      resource: string | null;
    });

const EMPTY_APPOINTMENT_FORM = (startTime: Date): AppointmentForm => ({
  customerName: "",
  customerPhone: "",
  employeeId: "",
  notes: "",
  serviceId: "",
  startTime,
});

/**
 * Formata valores para o timezone operacional da agenda.
 *
 * @author André Narcizo
 */
function formatAgendaDate(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    ...options,
  }).format(date);
}

/**
 * Extrai a data civil do calendário no timezone operacional.
 *
 * @author André Narcizo
 */
function getAgendaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Converte a data persistida na URL em um instante seguro para navegação do calendário.
 *
 * @author André Narcizo
 */
function dateFromFilter(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

/**
 * Gerencia agenda, filtros, reagendamentos e bloqueios pela Edge Function autorizada.
 *
 * @author André Narcizo
 */
export default function CalendarPage() {
  const { profile } = useAuth();
  const { employees } = useEmployees();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => normalizeAppointmentFilters(searchParams),
    [searchParams],
  );
  const {
    appointments,
    blocks,
    totalAppointments,
    loading,
    error,
    createAppointment,
    rescheduleAppointment,
    updateAppointmentStatus,
    cancelAppointment,
    createAppointmentBlock,
    deleteAppointmentBlock,
    creating,
    rescheduling,
    updatingStatus,
    cancelling,
    changingBlock,
  } = useAppointments(filters);
  const [form, setForm] = useState<AppointmentForm | null>(null);
  const [blockForm, setBlockForm] = useState<BlockForm | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["appointment-services", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error: queryError } = await supabase
        .from("services")
        .select("id, name, duration_minutes")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .order("name");
      if (queryError) throw queryError;
      return (data ?? []) as ServiceOption[];
    },
    enabled: Boolean(profile?.organization_id),
  });
  const services = servicesQuery.data ?? [];

  const events = useMemo<AgendaEvent[]>(() => {
    const statuses =
      filters.statuses.length > 0
        ? filters.statuses
        : (["pending", "confirmed", "completed"] as AppointmentStatus[]);

    const appointmentEvents = appointments
      .filter((appointment) => statuses.includes(appointment.status))
      .map((appointment) => ({
        id: appointment.id,
        title: `${appointment.customer_name} - ${appointment.service?.name || "Serviço"}`,
        start: new Date(appointment.start_time),
        end: new Date(appointment.end_time),
        appointment,
        kind: "appointment" as const,
        resource: appointment.employee_id ?? null,
      }));

    const blockEvents = blocks.map((block) => ({
      id: `block-${block.id}`,
      title: `Bloqueio${block.reason ? `: ${block.reason}` : ""}`,
      start: new Date(block.start_time),
      end: new Date(block.end_time),
      block,
      kind: "block" as const,
      resource: block.employee_id,
    }));

    return [...appointmentEvents, ...blockEvents];
  }, [appointments, blocks, filters.statuses]);

  /**
   * Atualiza filtros de URL sem perder a navegação compartilhável da agenda.
   *
   * @author André Narcizo
   */
  const updateFilters = (
    changes: Partial<
      Record<keyof AppointmentFilters, string | number | undefined>
    >,
  ): void => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        Object.entries(changes).forEach(([key, value]) => {
          const param =
            key === "employeeId"
              ? "employee"
              : key === "statuses"
                ? "status"
                : key;
          if (value === undefined || value === "") next.delete(param);
          else next.set(param, String(value));
        });
        if (!("page" in changes)) next.set("page", "1");
        return next;
      },
      { replace: true },
    );
  };

  /**
   * Abre a criação de um agendamento no intervalo selecionado.
   *
   * @author André Narcizo
   */
  const handleSelectSlot = (slot: SlotInfo): void => {
    setForm(EMPTY_APPOINTMENT_FORM(slot.start));
  };

  /**
   * Cria ou reagenda usando duração derivada do serviço no servidor.
   *
   * @author André Narcizo
   */
  const handleSaveAppointment = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!form) return;

    try {
      if (form.appointmentId) {
        await rescheduleAppointment({
          appointmentId: form.appointmentId,
          employeeId: form.employeeId || null,
          serviceId: form.serviceId,
          startTime: form.startTime.toISOString(),
        });
        toast.success("Agendamento reagendado.");
      } else {
        await createAppointment({
          customerName: form.customerName,
          customerPhone: form.customerPhone || null,
          employeeId: form.employeeId || null,
          notes: form.notes || null,
          serviceId: form.serviceId,
          startTime: form.startTime.toISOString(),
        });
        toast.success("Agendamento criado.");
      }
      setForm(null);
      setSelectedEvent(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o agendamento.",
      );
    }
  };

  /**
   * Cria um bloqueio operacional sem gravar a tabela diretamente no browser.
   *
   * @author André Narcizo
   */
  const handleCreateBlock = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!blockForm) return;

    try {
      await createAppointmentBlock({
        employeeId: blockForm.employeeId || null,
        startTime: blockForm.startTime.toISOString(),
        endTime: blockForm.endTime.toISOString(),
        reason: blockForm.reason || null,
      });
      toast.success("Bloqueio criado.");
      setBlockForm(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar o bloqueio.",
      );
    }
  };

  /**
   * Executa uma transição autorizada de status.
   *
   * @author André Narcizo
   */
  const handleStatusChange = async (
    appointment: Appointment,
    status: AppointmentStatus,
  ): Promise<void> => {
    try {
      if (status === "cancelled") await cancelAppointment(appointment.id);
      else await updateAppointmentStatus(appointment.id, status);
      toast.success(
        status === "cancelled"
          ? "Agendamento cancelado."
          : "Status atualizado.",
      );
      setSelectedEvent(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar o agendamento.",
      );
    }
  };

  /**
   * Remove bloqueio selecionado pelo comando autorizado do servidor.
   *
   * @author André Narcizo
   */
  const handleDeleteBlock = async (block: AppointmentBlock): Promise<void> => {
    try {
      await deleteAppointmentBlock(block.id);
      toast.success("Bloqueio removido.");
      setSelectedEvent(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Não foi possível remover o bloqueio.",
      );
    }
  };

  /**
   * Diferencia visualmente bloqueios, pendências e confirmações.
   *
   * @author André Narcizo
   */
  const eventStyleGetter = (event: AgendaEvent) => ({
    style: {
      backgroundColor:
        event.kind === "block"
          ? "#7c2d12"
          : event.appointment.status === "confirmed"
            ? "#5343d4"
            : event.appointment.status === "completed"
              ? "#047857"
              : "#00616f",
      border: "none",
      borderRadius: "8px",
      color: "white",
      fontSize: "12px",
      fontWeight: "bold",
      opacity: 0.9,
      padding: "4px",
    },
  });

  const currentDate = dateFromFilter(filters.date);
  const totalPages = Math.max(
    1,
    Math.ceil(totalAppointments / filters.pageSize),
  );

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-stitch-on-surface-variant text-sm font-medium mb-1 uppercase tracking-wider">
            Gestão de Agenda
          </p>
          <h1 className="font-headline text-4xl font-black tracking-tight text-stitch-on-surface">
            Calendário Mestre
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="outline"
            className="border-stitch-primary text-stitch-primary px-3 py-1 font-black"
          >
            PRO
          </Badge>
          <Button
            type="button"
            onClick={() => setForm(EMPTY_APPOINTMENT_FORM(currentDate))}
          >
            Novo agendamento
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setBlockForm({
                employeeId: filters.employeeId ?? "",
                startTime: currentDate,
                endTime: new Date(currentDate.getTime() + 60 * 60 * 1000),
                reason: "",
              })
            }
          >
            Novo bloqueio
          </Button>
        </div>
      </div>

      <section className="grid gap-3 rounded-2xl bg-stitch-surface-container-low p-4 md:grid-cols-3">
        <label className="space-y-1 text-sm font-semibold">
          Profissional
          <select
            className="h-10 w-full rounded-lg bg-stitch-surface-container px-3"
            value={filters.employeeId ?? ""}
            onChange={(event) =>
              updateFilters({ employeeId: event.target.value || undefined })
            }
          >
            <option value="">Toda a equipe</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Status
          <select
            className="h-10 w-full rounded-lg bg-stitch-surface-container px-3"
            value={filters.statuses.join(",")}
            onChange={(event) =>
              updateFilters({ statuses: event.target.value || undefined })
            }
          >
            <option value="">Ativos (padrão)</option>
            <option value="pending">Pendente</option>
            <option value="confirmed">Confirmado</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Itens por página
          <select
            className="h-10 w-full rounded-lg bg-stitch-surface-container px-3"
            value={filters.pageSize}
            onChange={(event) =>
              updateFilters({ pageSize: Number(event.target.value) })
            }
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-200"
        >
          {error}
        </p>
      )}

      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-stitch-surface-container-low/30 backdrop-blur-xl p-6 border border-white/5 min-h-[700px]">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 650 }}
          culture="pt-BR"
          messages={{
            next: "Próximo",
            previous: "Anterior",
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            day: "Dia",
            agenda: "Agenda",
            date: "Data",
            time: "Hora",
            event: "Evento",
            noEventsInRange: loading
              ? "Carregando agenda..."
              : "Sem eventos neste período.",
          }}
          view={filters.view}
          onView={(view) => updateFilters({ view })}
          date={currentDate}
          onNavigate={(nextDate) =>
            updateFilters({ date: getAgendaDateKey(nextDate) })
          }
          eventPropGetter={eventStyleGetter}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={(event) => setSelectedEvent(event as AgendaEvent)}
        />
      </Card>

      <nav
        className="flex items-center justify-end gap-3"
        aria-label="Paginação da agenda"
      >
        <Button
          type="button"
          variant="outline"
          disabled={filters.page === 1}
          onClick={() => updateFilters({ page: filters.page - 1 })}
        >
          Anterior
        </Button>
        <span className="text-sm font-semibold">
          Página {filters.page} de {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={filters.page >= totalPages}
          onClick={() => updateFilters({ page: filters.page + 1 })}
        >
          Próxima
        </Button>
      </nav>

      <Dialog
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form?.appointmentId
                ? "Reagendar atendimento"
                : "Novo agendamento"}
            </DialogTitle>
            <DialogDescription>
              {form &&
                formatAgendaDate(form.startTime, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <form className="space-y-4" onSubmit={handleSaveAppointment}>
              {!form.appointmentId && (
                <>
                  <label className="space-y-1 block">
                    <Label htmlFor="appointment-customer-name">
                      Nome do cliente
                    </Label>
                    <Input
                      id="appointment-customer-name"
                      required
                      maxLength={160}
                      value={form.customerName}
                      onChange={(event) =>
                        setForm({ ...form, customerName: event.target.value })
                      }
                    />
                  </label>
                  <label className="space-y-1 block">
                    <Label htmlFor="appointment-customer-phone">Telefone</Label>
                    <Input
                      id="appointment-customer-phone"
                      maxLength={30}
                      value={form.customerPhone}
                      onChange={(event) =>
                        setForm({ ...form, customerPhone: event.target.value })
                      }
                    />
                  </label>
                </>
              )}
              <label className="space-y-1 block">
                <Label htmlFor="appointment-service">Serviço</Label>
                <select
                  id="appointment-service"
                  required
                  className="h-12 w-full rounded-stitch-md bg-stitch-surface-container px-3"
                  value={form.serviceId}
                  onChange={(event) =>
                    setForm({ ...form, serviceId: event.target.value })
                  }
                >
                  <option value="">Selecione um serviço</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.duration_minutes} min)
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 block">
                <Label htmlFor="appointment-employee">Profissional</Label>
                <select
                  id="appointment-employee"
                  className="h-12 w-full rounded-stitch-md bg-stitch-surface-container px-3"
                  value={form.employeeId}
                  onChange={(event) =>
                    setForm({ ...form, employeeId: event.target.value })
                  }
                >
                  <option value="">Sem profissional</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </option>
                  ))}
                </select>
              </label>
              {!form.appointmentId && (
                <label className="space-y-1 block">
                  <Label htmlFor="appointment-notes">Observações</Label>
                  <textarea
                    id="appointment-notes"
                    className="min-h-24 w-full rounded-stitch-md bg-stitch-surface-container p-3"
                    maxLength={2000}
                    value={form.notes}
                    onChange={(event) =>
                      setForm({ ...form, notes: event.target.value })
                    }
                  />
                </label>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={creating || rescheduling || servicesQuery.isLoading}
              >
                {form.appointmentId ? "Reagendar" : "Criar agendamento"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={blockForm !== null}
        onOpenChange={(open) => !open && setBlockForm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo bloqueio</DialogTitle>
            <DialogDescription>
              Impede novos agendamentos no período selecionado.
            </DialogDescription>
          </DialogHeader>
          {blockForm && (
            <form className="space-y-4" onSubmit={handleCreateBlock}>
              <label className="space-y-1 block">
                <Label htmlFor="block-employee">Profissional</Label>
                <select
                  id="block-employee"
                  className="h-12 w-full rounded-stitch-md bg-stitch-surface-container px-3"
                  value={blockForm.employeeId}
                  onChange={(event) =>
                    setBlockForm({
                      ...blockForm,
                      employeeId: event.target.value,
                    })
                  }
                >
                  <option value="">Toda a organização</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 block">
                <Label htmlFor="block-reason">Motivo</Label>
                <Input
                  id="block-reason"
                  maxLength={500}
                  value={blockForm.reason}
                  onChange={(event) =>
                    setBlockForm({ ...blockForm, reason: event.target.value })
                  }
                />
              </label>
              <p className="text-sm text-stitch-on-surface-variant">
                {formatAgendaDate(blockForm.startTime, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}{" "}
                até{" "}
                {formatAgendaDate(blockForm.endTime, { timeStyle: "short" })}
              </p>
              <Button type="submit" className="w-full" disabled={changingBlock}>
                Criar bloqueio
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedEvent !== null}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      >
        <DialogContent>
          {selectedEvent?.kind === "appointment" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedEvent.appointment.customer_name}
                </DialogTitle>
                <DialogDescription>
                  {formatAgendaDate(
                    new Date(selectedEvent.appointment.start_time),
                    { dateStyle: "short", timeStyle: "short" },
                  )}{" "}
                  · {selectedEvent.appointment.status}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-3">
                {selectedEvent.appointment.status === "pending" && (
                  <Button
                    type="button"
                    onClick={() =>
                      handleStatusChange(selectedEvent.appointment, "confirmed")
                    }
                    disabled={updatingStatus}
                  >
                    Confirmar
                  </Button>
                )}
                {selectedEvent.appointment.status === "confirmed" && (
                  <Button
                    type="button"
                    onClick={() =>
                      handleStatusChange(selectedEvent.appointment, "completed")
                    }
                    disabled={updatingStatus}
                  >
                    Concluir
                  </Button>
                )}
                {(selectedEvent.appointment.status === "pending" ||
                  selectedEvent.appointment.status === "confirmed") && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setForm({
                          appointmentId: selectedEvent.appointment.id,
                          customerName: selectedEvent.appointment.customer_name,
                          customerPhone:
                            selectedEvent.appointment.customer_phone,
                          employeeId:
                            selectedEvent.appointment.employee_id ?? "",
                          notes: selectedEvent.appointment.notes ?? "",
                          serviceId: selectedEvent.appointment.service_id,
                          startTime: new Date(
                            selectedEvent.appointment.start_time,
                          ),
                        })
                      }
                    >
                      Reagendar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() =>
                        handleStatusChange(
                          selectedEvent.appointment,
                          "cancelled",
                        )
                      }
                      disabled={cancelling || updatingStatus}
                    >
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
          {selectedEvent?.kind === "block" && (
            <>
              <DialogHeader>
                <DialogTitle>Bloqueio de agenda</DialogTitle>
                <DialogDescription>
                  {selectedEvent.block.reason || "Sem motivo informado"}
                </DialogDescription>
              </DialogHeader>
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleDeleteBlock(selectedEvent.block)}
                disabled={changingBlock}
              >
                Remover bloqueio
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
