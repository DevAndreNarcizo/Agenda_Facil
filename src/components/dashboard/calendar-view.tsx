import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, dateFnsLocalizer, type Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Appointment } from "@/hooks/use-appointments";
import "react-big-calendar/lib/css/react-big-calendar.css";

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
}

// Converter agendamentos para eventos do calendário
function appointmentsToEvents(appointments: Appointment[]): Event[] {
  return appointments.map((apt) => ({
    title: `${apt.customer_name} - ${apt.service?.name || "Serviço"}`,
    start: new Date(apt.scheduled_at),
    end: new Date(
      new Date(apt.scheduled_at).getTime() + (apt.service?.duration_minutes || 60) * 60000
    ),
    resource: apt,
  }));
}

export function CalendarView({ appointments }: CalendarViewProps) {
  const events = appointmentsToEvents(appointments);

  // Estilo customizado para eventos baseado no status
  const eventStyleGetter = (event: Event) => {
    const appointment = event.resource as Appointment;
    
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
        borderRadius: "5px",
        opacity: 0.8,
        color: "white",
        border: `1px solid ${style.borderColor}`,
        display: "block",
      },
    };
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Calendário de Agendamentos</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: "600px" }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
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
          />
        </div>
      </CardContent>
    </Card>
  );
}
