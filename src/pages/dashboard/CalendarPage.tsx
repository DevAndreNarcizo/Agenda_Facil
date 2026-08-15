import { type FormEvent, useMemo, useState } from "react";
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
  type AppointmentStatus,
  useAppointments,
} from "@/hooks/use-appointments";
import { useEmployees } from "@/hooks/use-employees";
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
import { getCalendarView } from "@/lib/calendar-view";

const locales = {
  "pt-BR": ptBR,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface AppointmentEvent extends CalendarEvent {
  appointment: Appointment;
  resource: string;
}

interface AppointmentForm {
  customerName: string;
  customerPhone: string;
  employeeId: string;
  durationMinutes: number;
  notes: string;
  startTime: Date;
}

const DEFAULT_DURATION_MINUTES = 30;

/**
 * Formata um instante da agenda no fuso operacional padrão.
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
 * Cria o estado inicial do formulário a partir de uma faixa do calendário.
 *
 * @author André Narcizo
 */
function createFormFromSlot(startTime: Date, endTime?: Date): AppointmentForm {
  const duration = endTime
    ? Math.round((endTime.getTime() - startTime.getTime()) / 60_000)
    : DEFAULT_DURATION_MINUTES;

  return {
    customerName: "",
    customerPhone: "",
    employeeId: "",
    durationMinutes: duration > 0 ? duration : DEFAULT_DURATION_MINUTES,
    notes: "",
    startTime,
  };
}

/**
 * Gerencia os agendamentos ativos pelo calendário, sempre usando a Edge Function autorizada.
 *
 * @author André Narcizo
 */
export default function CalendarPage() {
  const {
    appointments,
    loading,
    error,
    createAppointment,
    updateAppointmentStatus,
    cancelAppointment,
    creating,
    updatingStatus,
    cancelling,
  } = useAppointments();
  const { employees } = useEmployees();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = getCalendarView(searchParams.get("view"));
  const [date, setDate] = useState(new Date());
  const [form, setForm] = useState<AppointmentForm | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);

  const events = useMemo<AppointmentEvent[]>(
    () =>
      appointments
        .filter((appointment) => appointment.status !== "cancelled")
        .map((appointment) => ({
          id: appointment.id,
          title: `${appointment.customer_name} - ${appointment.service?.name || "Serviço"}`,
          start: new Date(appointment.start_time),
          end: new Date(appointment.end_time),
          appointment,
          resource: appointment.employee_id,
        })),
    [appointments],
  );

  /**
   * Persiste a visualização escolhida na URL para navegação compartilhável.
   *
   * @author André Narcizo
   */
  const handleViewChange = (
    nextView: import("react-big-calendar").View,
  ): void => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("view", nextView);
        return next;
      },
      { replace: true },
    );
  };

  /**
   * Abre o formulário de criação a partir de um intervalo selecionado no calendário.
   *
   * @author André Narcizo
   */
  const handleSelectSlot = (slot: SlotInfo): void => {
    setForm(createFormFromSlot(slot.start, slot.end));
  };

  /**
   * Envia a criação com horários normalizados em UTC para a Edge Function.
   *
   * @author André Narcizo
   */
  const handleCreateAppointment = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!form) return;

    const endTime = new Date(form.startTime);
    endTime.setMinutes(endTime.getMinutes() + form.durationMinutes);

    try {
      await createAppointment({
        customerName: form.customerName,
        customerPhone: form.customerPhone || null,
        employeeId: form.employeeId || null,
        startTime: form.startTime.toISOString(),
        endTime: endTime.toISOString(),
        notes: form.notes || null,
      });
      toast.success("Agendamento criado com sucesso.");
      setForm(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar o agendamento.",
      );
    }
  };

  /**
   * Executa uma transição autorizada e fecha o detalhe somente após sucesso.
   *
   * @author André Narcizo
   */
  const handleStatusChange = async (
    status: AppointmentStatus,
  ): Promise<void> => {
    if (!selectedAppointment) return;

    try {
      if (status === "cancelled") {
        await cancelAppointment(selectedAppointment.id);
        toast.success("Agendamento cancelado.");
      } else {
        await updateAppointmentStatus(selectedAppointment.id, status);
        toast.success("Status do agendamento atualizado.");
      }
      setSelectedAppointment(null);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar o agendamento.",
      );
    }
  };

  /**
   * Define o estilo visual do evento conforme seu profissional e status.
   *
   * @author André Narcizo
   */
  const eventStyleGetter = (event: AppointmentEvent) => {
    const employee = employees.find((item) => item.id === event.resource);
    const backgroundColor =
      event.appointment.status === "confirmed"
        ? "#5343d4"
        : employee?.role === "admin"
          ? "#5343d4"
          : "#00616f";

    return {
      style: {
        backgroundColor,
        borderRadius: "8px",
        opacity: 0.9,
        color: "white",
        border: "none",
        display: "block",
        fontSize: "12px",
        fontWeight: "bold",
        padding: "4px",
      },
    };
  };

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
        <div className="flex items-center gap-3 bg-stitch-surface-container-low/30 p-2 rounded-2xl border border-white/5">
          <Badge
            variant="outline"
            className="border-stitch-primary text-stitch-primary px-3 py-1 font-black"
          >
            PRO
          </Badge>
          <p className="text-sm font-bold text-stitch-on-surface-variant opacity-60">
            Visão Geral da Equipe
          </p>
          <Button
            type="button"
            onClick={() => setForm(createFormFromSlot(date))}
            aria-label="Criar novo agendamento"
          >
            Novo agendamento
          </Button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-200"
        >
          {error}
        </p>
      )}

      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-stitch-surface-container-low/30 backdrop-blur-xl p-6 border border-white/5 min-h-[700px]">
        <style>{`
          .rbc-calendar { color: #e2e2e2 !important; font-family: inherit !important; }
          .rbc-header { padding: 12px !important; font-weight: 900 !important; text-transform: uppercase !important; font-size: 11px !important; letter-spacing: 0.1em !important; color: #8c8c8c !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; }
          .rbc-today { background-color: rgba(83, 67, 212, 0.05) !important; }
          .rbc-off-range-bg { background-color: rgba(0,0,0,0.1) !important; }
          .rbc-time-view, .rbc-month-view { border: 1px solid rgba(255,255,255,0.05) !important; border-radius: 20px !important; }
          .rbc-time-header-content { border-left: 1px solid rgba(255,255,255,0.05) !important; }
          .rbc-timeslot-group { border-bottom: 1px solid rgba(255,255,255,0.03) !important; min-height: 60px !important; }
          .rbc-day-slot .rbc-time-slot { border-top: 1px solid rgba(255,255,255,0.02) !important; }
          .rbc-toolbar button { color: #fff !important; border: 1px solid rgba(255,255,255,0.1) !important; background: rgba(255,255,255,0.05) !important; border-radius: 8px !important; margin: 0 2px !important; padding: 8px 16px !important; font-weight: 700 !important; text-transform: none !important; transition: all 0.2s !important; }
          .rbc-toolbar button:hover { background: rgba(83, 67, 212, 0.2) !important; }
          .rbc-toolbar button.rbc-active { background: #5343d4 !important; box-shadow: 0 4px 12px rgba(83, 67, 212, 0.3) !important; }
          .rbc-event { box-shadow: 0 4px 6px rgba(0,0,0,0.2) !important; }
        `}</style>
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
              : "Sem agendamentos ativos nesta data.",
          }}
          view={view}
          onView={handleViewChange}
          date={date}
          onNavigate={setDate}
          eventPropGetter={eventStyleGetter}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={(event) =>
            setSelectedAppointment((event as AppointmentEvent).appointment)
          }
        />
      </Card>

      <Dialog
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
            <DialogDescription>
              {form &&
                `Horário: ${formatAgendaDate(form.startTime, { dateStyle: "short", timeStyle: "short" })}`}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <form className="space-y-4" onSubmit={handleCreateAppointment}>
              <div className="space-y-2">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointment-customer-phone">Telefone</Label>
                <Input
                  id="appointment-customer-phone"
                  maxLength={30}
                  value={form.customerPhone}
                  onChange={(event) =>
                    setForm({ ...form, customerPhone: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointment-duration">Duração (minutos)</Label>
                <Input
                  id="appointment-duration"
                  type="number"
                  min={5}
                  max={720}
                  required
                  value={form.durationMinutes}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      durationMinutes: Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointment-employee">Profissional</Label>
                <select
                  id="appointment-employee"
                  className="flex h-12 w-full rounded-stitch-md bg-stitch-surface-container px-4 text-sm"
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointment-notes">Observações</Label>
                <textarea
                  id="appointment-notes"
                  className="min-h-24 w-full rounded-stitch-md bg-stitch-surface-container p-4 text-sm"
                  maxLength={2000}
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Criando agendamento..." : "Criar agendamento"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedAppointment !== null}
        onOpenChange={(open) => !open && setSelectedAppointment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedAppointment?.customer_name}</DialogTitle>
            <DialogDescription>
              {selectedAppointment &&
                `${formatAgendaDate(new Date(selectedAppointment.start_time), { dateStyle: "short", timeStyle: "short" })} · ${selectedAppointment.status}`}
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <p className="text-sm text-stitch-on-surface-variant">
                {selectedAppointment.notes || "Nenhuma observação cadastrada."}
              </p>
              <div className="flex flex-wrap gap-3">
                {selectedAppointment.status === "pending" && (
                  <Button
                    type="button"
                    onClick={() => handleStatusChange("confirmed")}
                    disabled={updatingStatus}
                  >
                    Confirmar
                  </Button>
                )}
                {selectedAppointment.status === "confirmed" && (
                  <Button
                    type="button"
                    onClick={() => handleStatusChange("completed")}
                    disabled={updatingStatus}
                  >
                    Concluir
                  </Button>
                )}
                {(selectedAppointment.status === "pending" ||
                  selectedAppointment.status === "confirmed") && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleStatusChange("cancelled")}
                    disabled={cancelling || updatingStatus}
                  >
                    Cancelar agendamento
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
