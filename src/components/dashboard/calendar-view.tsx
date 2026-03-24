import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, dateFnsLocalizer, type Event, type View, Views } from "react-big-calendar";
import { useState, useCallback } from "react";
import { format, parse, startOfWeek, getDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Appointment } from "@/hooks/use-appointments";
import { holidays } from "@/lib/holidays";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { EditAppointmentModal } from "./edit-appointment-modal";
import { CreateAppointmentModal } from "./create-appointment-modal";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

const DnDCalendar = withDragAndDrop(Calendar);

// Configurar localização do calendário
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

// Props do componente
interface CalendarViewProps {
  appointments: Appointment[]; // Lista de agendamentos
  onAppointmentUpdate?: (id: string, updates: Partial<Appointment>) => Promise<void>;
  onAppointmentCreated?: () => void;
}

// Converter agendamentos para eventos do calendário
function appointmentsToEvents(appointments: Appointment[]): Event[] {
  const appointmentEvents = appointments.map((apt) => {
    const professionalName = apt.employee?.full_name ? ` (${apt.employee.full_name.split(' ')[0]})` : "";
    return {
      title: apt.is_blocked ? "🚫 HORÁRIO BLOQUEADO" : `${apt.customer_name} - ${apt.service?.name || "Serviço"}${professionalName}`,
      start: new Date(apt.start_time),
      end: new Date(apt.end_time),
      resource: { type: "appointment", data: apt },
    };
  });

  const holidayEvents = holidays.map((holiday) => {
    // Adiciona 12h para garantir que o fuso horário não mude o dia
    const date = new Date(`${holiday.date}T12:00:00`);
    return {
      title: `🎉 ${holiday.name}`,
      start: date,
      end: date,
      allDay: true,
      resource: { type: "holiday" },
    };
  });

  return [...appointmentEvents, ...holidayEvents];
}

export function CalendarView({ appointments, onAppointmentUpdate, onAppointmentCreated }: CalendarViewProps) {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<View>(Views.MONTH);
  
  // Modal States
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [slotDate, setSlotDate] = useState<Date | undefined>(undefined);

  const events = appointmentsToEvents(appointments);

  // Manipulador de navegação (Anterior, Próximo, Hoje)
  const onNavigate = useCallback((newDate: Date) => setDate(newDate), [setDate]);

  // Manipulador de mudança de visualização (Mês, Semana, Dia, Agenda)
  const onView = useCallback((newView: View) => {
    setView(newView);
    // Se mudar para dia ou semana, volta para a data atual conforme solicitado
    if (newView === Views.DAY || newView === Views.WEEK) {
      setDate(new Date());
    }
  }, [setView, setDate]);

  // Manipulador de seleção de evento
  const onSelectEvent = (event: Event) => {
    const resource = event.resource as { type: string; data?: Appointment };
    if (resource.type === "appointment" && resource.data) {
      setSelectedAppointment(resource.data);
      setEditModalOpen(true);
    }
  };

  const onEventDrop = useCallback(
    ({ event, start, end }: { event: Event; start: string | Date; end: string | Date }) => {
      const resource = event.resource as { type: string; data?: Appointment };
      if (resource.type === "appointment" && resource.data && onAppointmentUpdate) {
        onAppointmentUpdate(resource.data.id, {
          start_time: (start as Date).toISOString(),
          end_time: (end as Date).toISOString(),
        });
      }
    },
    [onAppointmentUpdate]
  );

  const onEventResize = useCallback(
    ({ event, start, end }: { event: Event; start: string | Date; end: string | Date }) => {
      const resource = event.resource as { type: string; data?: Appointment };
      if (resource.type === "appointment" && resource.data && onAppointmentUpdate) {
        onAppointmentUpdate(resource.data.id, {
          start_time: (start as Date).toISOString(),
          end_time: (end as Date).toISOString(),
        });
      }
    },
    [onAppointmentUpdate]
  );

  // Estilo customizado para eventos baseado no status
  const eventStyleGetter = (event: Event) => {
    const resource = event.resource as { type: string; data?: Appointment };
    
    if (resource.type === "holiday") {
      return {
        style: {
          backgroundColor: "#fef3c7", // Amarelo claro
          color: "#d97706", // Laranja escuro
          border: "1px solid #fcd34d",
          borderRadius: "8px",
          fontWeight: "black",
          fontSize: "0.75rem",
          padding: "2px 6px",
        },
      };
    }

    const appointment = resource.data!;

    if (appointment.is_blocked) {
      return {
        style: {
          backgroundColor: "#1e1b4b", // Indigo muito escuro (Sovereign)
          color: "#818cf8",
          border: "1px dashed #4338ca",
          borderRadius: "8px",
          opacity: 0.9,
          fontWeight: "bold",
          fontSize: "0.75rem",
          padding: "2px 8px",
        }
      };
    }

    const colors = {
      pending: { backgroundColor: "#fbbf24", borderColor: "#f59e0b" },
      confirmed: { backgroundColor: "#3b82f6", borderColor: "#2563eb" },
      completed: { backgroundColor: "#10b981", borderColor: "#059669" },
      cancelled: { backgroundColor: "#ef4444", borderColor: "#dc2626" },
    };

    const style = colors[appointment.status] || { backgroundColor: "#6b7280", borderColor: "#4b5563" };

    return {
      style: {
        ...style,
        borderRadius: "8px",
        opacity: 0.9,
        color: "white",
        border: "none",
        display: "block",
        fontWeight: "bold",
        fontSize: "0.75rem",
        padding: "2px 8px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      },
    };
  };

  // Estilo para destacar o dia atual
  const dayPropGetter = (date: Date) => {
    const today = new Date();
    if (isSameDay(date, today)) {
      return {
        className: "bg-stitch-primary/5 font-bold",
        style: {
          backgroundColor: "rgba(59, 130, 246, 0.05)",
        },
      };
    }
    return {
      className: "font-bold text-stitch-on-surface/40",
    };
  };

  return (
    <Card className="col-span-full rounded-[2.5rem] border-none shadow-2xl shadow-stitch-primary/5 bg-stitch-surface-container-low/30 overflow-hidden font-sans">
      <CardHeader className="p-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
              <span className="material-symbols-outlined text-3xl">event_upcoming</span>
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-stitch-on-surface tracking-tight">Agenda Completa</CardTitle>
              <p className="text-sm font-bold text-stitch-on-surface-variant opacity-60">Gerencie todos os seus compromissos</p>
            </div>
          </div>
          <Button 
            className="h-14 px-8 rounded-2xl font-black gap-2 shadow-lg shadow-stitch-primary/10"
            onClick={() => {
                setSlotDate(new Date());
                setCreateModalOpen(true);
            }}
          >
            <span className="material-symbols-outlined">add_circle</span>
            Novo Agendamento
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-8">
        <div style={{ height: "700px" }} className="calendar-container rounded-3xl overflow-hidden bg-stitch-surface-container-lowest border border-stitch-outline-variant/10 shadow-sm p-4">
          <DnDCalendar
            localizer={localizer}
            events={events}
            startAccessor={(event: Event) => event.start as Date}
            endAccessor={(event: Event) => event.end as Date}
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
              noEventsInRange: "Não há agendamentos neste período.",
              showMore: (total) => `+ Ver mais (${total})`,
            }}
            eventPropGetter={eventStyleGetter}
            dayPropGetter={dayPropGetter}
            views={["month", "week", "day", "agenda"]}
            date={date}
            view={view}
            onNavigate={onNavigate}
            onView={onView}
            onSelectEvent={onSelectEvent}
            onSelectSlot={(slotInfo) => {
              setSlotDate(slotInfo.start as Date);
              setCreateModalOpen(true);
            }}
            onEventDrop={onEventDrop}
            onEventResize={onEventResize}
            resizable
            selectable
          />
        </div>

        <EditAppointmentModal
          appointment={selectedAppointment}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onAppointmentUpdated={() => {
            setEditModalOpen(false);
          }}
        />

        <CreateAppointmentModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          defaultDate={slotDate}
          onAppointmentCreated={() => {
            setCreateModalOpen(false);
            onAppointmentCreated?.();
          }}
        />
      </CardContent>
    </Card>
  );
}
