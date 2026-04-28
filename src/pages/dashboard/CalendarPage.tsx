import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar, dateFnsLocalizer, type View, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useAppointments } from "@/hooks/use-appointments";
import { useEmployees } from "@/hooks/use-employees";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export default function CalendarPage() {
  const { appointments } = useAppointments();
  const { employees } = useEmployees();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<View>(() => {
    const v = searchParams.get("view");
    if (v === "day") return Views.DAY;
    if (v === "month") return Views.MONTH;
    return Views.WEEK;
  });
  const [date, setDate] = useState(new Date());

  const events = appointments.map((apt) => ({
    id: apt.id,
    title: `${apt.customer_name} - ${apt.service?.name || "Serviço"}`,
    start: new Date(apt.start_time),
    end: new Date(apt.end_time),
    resource: apt.employee_id,
  }));

  const eventStyleGetter = (event: { resource?: string }) => {
    const employee = employees.find(e => e.id === event.resource);
    const backgroundColor = employee?.role === 'admin' ? '#5343d4' : '#00616f';
    return {
      style: {
        backgroundColor,
        borderRadius: '8px',
        opacity: 0.8,
        color: 'white',
        border: 'none',
        display: 'block',
        fontSize: '12px',
        fontWeight: 'bold',
        padding: '4px'
      }
    };
  };

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-stitch-on-surface-variant text-sm font-medium mb-1 uppercase tracking-wider">Gestão de Agenda</p>
          <h1 className="font-headline text-4xl font-black tracking-tight text-stitch-on-surface">Calendário Mestre</h1>
        </div>
        <div className="flex items-center gap-3 bg-stitch-surface-container-low/30 p-2 rounded-2xl border border-white/5">
           <Badge variant="outline" className="border-stitch-primary text-stitch-primary px-3 py-1 font-black">PRO</Badge>
           <p className="text-sm font-bold text-stitch-on-surface-variant opacity-60">Visão Geral da Equipe</p>
        </div>
      </div>

      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-stitch-surface-container-low/30 backdrop-blur-xl p-6 border border-white/5 min-h-[700px]">
        <style>{`
          .rbc-calendar {
            color: #e2e2e2 !important;
            font-family: inherit !important;
          }
          .rbc-header {
            padding: 12px !important;
            font-weight: 900 !important;
            text-transform: uppercase !important;
            font-size: 11px !important;
            letter-spacing: 0.1em !important;
            color: #8c8c8c !important;
            border-bottom: 1px solid rgba(255,255,255,0.05) !important;
          }
          .rbc-today {
            background-color: rgba(83, 67, 212, 0.05) !important;
          }
          .rbc-off-range-bg {
            background-color: rgba(0,0,0,0.1) !important;
          }
          .rbc-time-view, .rbc-month-view {
            border: 1px solid rgba(255,255,255,0.05) !important;
            border-radius: 20px !important;
          }
          .rbc-time-header-content {
            border-left: 1px solid rgba(255,255,255,0.05) !important;
          }
          .rbc-timeslot-group {
            border-bottom: 1px solid rgba(255,255,255,0.03) !important;
            min-height: 60px !important;
          }
          .rbc-day-slot .rbc-time-slot {
            border-top: 1px solid rgba(255,255,255,0.02) !important;
          }
          .rbc-toolbar button {
            color: #fff !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            background: rgba(255,255,255,0.05) !important;
            border-radius: 8px !important;
            margin: 0 2px !important;
            padding: 8px 16px !important;
            font-weight: 700 !important;
            text-transform: none !important;
            transition: all 0.2s !important;
          }
          .rbc-toolbar button:hover {
            background: rgba(83, 67, 212, 0.2) !important;
          }
          .rbc-toolbar button.rbc-active {
            background: #5343d4 !important;
            box-shadow: 0 4px 12px rgba(83, 67, 212, 0.3) !important;
          }
          .rbc-event {
            box-shadow: 0 4px 6px rgba(0,0,0,0.2) !important;
          }
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
            noEventsInRange: "Sem agendamentos nesta data.",
          }}
          view={view}
          onView={(v) => setView(v)}
          date={date}
          onNavigate={(d) => setDate(d)}
          eventPropGetter={eventStyleGetter}
        />
      </Card>
    </div>
  );
}
