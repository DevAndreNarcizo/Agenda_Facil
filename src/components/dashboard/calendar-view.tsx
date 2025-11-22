import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, dateFnsLocalizer, type Event, type View, Views } from "react-big-calendar";
import { useState, useCallback } from "react";
import { format, parse, startOfWeek, getDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Appointment } from "@/hooks/use-appointments";
import { holidays } from "@/lib/holidays";
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
  const appointmentEvents = appointments.map((apt) => ({
    title: `${apt.customer_name} - ${apt.service?.name || "Serviço"}`,
    start: new Date(apt.start_time),
    end: new Date(apt.end_time),
    resource: { type: "appointment", data: apt },
  }));

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

export function CalendarView({ appointments }: CalendarViewProps) {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<View>(Views.MONTH);

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

  // Estilo customizado para eventos baseado no status
  const eventStyleGetter = (event: Event) => {
    const resource = event.resource as { type: string; data?: Appointment };
    
    if (resource.type === "holiday") {
      return {
        style: {
          backgroundColor: "#fef3c7", // Amarelo claro
          color: "#d97706", // Laranja escuro
          border: "1px solid #fcd34d",
          borderRadius: "4px",
          fontWeight: "bold",
          fontSize: "0.85rem",
        },
      };
    }

    const appointment = resource.data!;
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
        opacity: 0.9,
        color: "white",
        border: `1px solid ${style.borderColor}`,
        display: "block",
      },
    };
  };

  // Estilo para destacar o dia atual
  const dayPropGetter = (date: Date) => {
    const today = new Date();
    if (isSameDay(date, today)) {
      return {
        className: "bg-primary/5 border border-primary/30 font-medium",
        style: {
          backgroundColor: "hsl(var(--primary) / 0.05)",
        },
      };
    }
    return {};
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Calendário de Agendamentos</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: "600px" }} className="calendar-container">
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
            dayPropGetter={dayPropGetter}
            views={["month", "week", "day", "agenda"]}
            date={date}
            view={view}
            onNavigate={onNavigate}
            onView={onView}
          />
        </div>
      </CardContent>
    </Card>
  );
}
