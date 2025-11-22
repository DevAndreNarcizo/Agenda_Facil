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
  const chartData = Array.from({ length: 7 }, (_, i) => {
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
    <Card>
      <CardHeader>
        <CardTitle>Agendamentos - Últimos 7 Dias</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              interval={0} 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)} // Capitalizar primeira letra
            />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#8884d8" name="Agendamentos" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
