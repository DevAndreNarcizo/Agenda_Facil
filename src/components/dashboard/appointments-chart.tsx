import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Appointment } from "@/hooks/use-appointments";
import { subDays, format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

// Props do componente
interface AppointmentsChartProps {
  appointments: Appointment[]; // Lista de agendamentos
}

export function AppointmentsChart({ appointments }: AppointmentsChartProps) {
  // Gerar dados dos últimos 7 dias
  const chartData = Array.from({ length: 7 }, (_: unknown, i: number) => {
    const date = subDays(new Date(), 6 - i);
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Contar agendamentos do dia
    const count = appointments.filter((apt) => {
      const scheduledDate = new Date(apt.start_time);
      return isWithinInterval(scheduledDate, { start: dayStart, end: dayEnd });
    }).length;

    return {
      date: format(date, "eeee", { locale: ptBR }).replace("-feira", ""), // Dia da semana completo sem -feira
      count,
    };
  });

  return (
    <Card className="rounded-[2rem] border-none shadow-xl shadow-stitch-primary/5 bg-stitch-surface-container-low/30 overflow-hidden font-sans">
      <CardHeader className="p-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
            <span className="material-symbols-outlined">bar_chart</span>
          </div>
          <CardTitle className="text-xl font-black text-stitch-on-surface">Agendamentos</CardTitle>
        </div>
        <p className="text-xs font-bold text-stitch-on-surface-variant opacity-60 ml-13 mt-1">Últimos 7 dias de atividade</p>
      </CardHeader>
      <CardContent className="px-6 pb-8">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                interval={0} 
                tick={{ fontSize: 11, fontWeight: 'bold', fill: 'rgba(0,0,0,0.4)' }}
                tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)} 
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fontWeight: 'bold', fill: 'rgba(0,0,0,0.4)' }}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                contentStyle={{ 
                  borderRadius: '1rem', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              />
              <Bar 
                dataKey="count" 
                fill="#3b82f6" 
                name="Agendamentos" 
                radius={[6, 6, 0, 0]}
                barSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
