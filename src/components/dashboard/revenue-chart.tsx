import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Appointment } from "@/hooks/use-appointments";
import { subDays, format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

// Props do componente
interface RevenueChartProps {
  appointments: Appointment[]; // Lista de agendamentos
}

export function RevenueChart({ appointments }: RevenueChartProps) {
  // Gerar dados dos últimos 7 dias
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Calcular receita do dia (apenas agendamentos completados)
    const revenue = appointments
      .filter((apt) => {
        const scheduledDate = new Date(apt.scheduled_at);
        return (
          apt.status === "completed" &&
          isWithinInterval(scheduledDate, { start: dayStart, end: dayEnd })
        );
      })
      .reduce((sum, apt) => sum + (apt.service?.price || 0), 0);

    return {
      date: format(date, "EEE", { locale: ptBR }), // Dia da semana abreviado
      revenue,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receita - Últimos 7 Dias</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => `R$ ${value.toFixed(2)}`}
            />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Receita"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
