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
  const chartData = Array.from({ length: 7 }, (_: unknown, i: number) => {
    const date = subDays(new Date(), 6 - i);
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Calcular receita do dia (apenas agendamentos pagos)
    const revenue = appointments
      .filter((apt) => {
        const scheduledDate = new Date(apt.start_time);
        return (
          apt.payment_status === 'paid' &&
          isWithinInterval(scheduledDate, { start: dayStart, end: dayEnd })
        );
      })
      .reduce((sum, apt) => sum + (apt.amount_paid || apt.service?.price || 0), 0);

    return {
      date: format(date, "eeee", { locale: ptBR }).replace("-feira", ""), // Dia da semana completo sem -feira
      revenue,
    };
  });

  return (
    <Card className="rounded-[2rem] border-none shadow-xl shadow-stitch-primary/5 bg-stitch-surface-container-low/30 overflow-hidden font-sans">
      <CardHeader className="p-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
            <span className="material-symbols-outlined">payments</span>
          </div>
          <CardTitle className="text-xl font-black text-stitch-on-surface">Receita Total</CardTitle>
        </div>
        <p className="text-xs font-bold text-stitch-on-surface-variant opacity-60 ml-13 mt-1">Ganhos nos últimos 7 dias</p>
      </CardHeader>
      <CardContent className="px-6 pb-8">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
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
                tickFormatter={(value: number) => `R$ ${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '1rem', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#3b82f6" 
                strokeWidth={4}
                dot={{ r: 6, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 8, fill: '#3b82f6', stroke: '#fff', strokeWidth: 3 }}
                name="Receita"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
