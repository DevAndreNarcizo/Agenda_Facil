import { StatsCard } from "@/components/ui/stats-card";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { AppointmentsChart } from "@/components/dashboard/appointments-chart";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { RecentAppointments } from "@/components/dashboard/recent-appointments";
import { useAppointments } from "@/hooks/use-appointments";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { Calendar, DollarSign, TrendingUp, Users } from "lucide-react";

export default function DashboardHome() {
  const { appointments, loading } = useAppointments();
  const stats = useDashboardStats(appointments);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Bem-vindo de volta! Aqui está um resumo do seu negócio.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Agendamentos Hoje"
          value={stats.todayAppointments}
          icon={Calendar}
          description={`${stats.todayAppointments} agendamento${stats.todayAppointments !== 1 ? 's' : ''} para hoje`}
          trend="neutral"
        />
        <StatsCard
          title="Agendamentos do Mês"
          value={stats.monthAppointments}
          icon={Users}
          description={`Total de agendamentos em ${new Date().toLocaleDateString('pt-BR', { month: 'long' })}`}
          trend="up"
        />
        <StatsCard
          title="Receita do Mês"
          value={`R$ ${stats.monthRevenue.toFixed(2)}`}
          icon={DollarSign}
          description="Receita de agendamentos completados"
          trend="up"
        />
        <StatsCard
          title="Taxa de Conclusão"
          value={`${stats.completedRate}%`}
          icon={TrendingUp}
          description={`${stats.completedRate}% dos agendamentos foram concluídos`}
          trend={stats.completedRate >= 80 ? "up" : stats.completedRate >= 50 ? "neutral" : "down"}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <AppointmentsChart appointments={appointments} />
        <RevenueChart appointments={appointments} />
      </div>

      {/* Calendar */}
      <CalendarView appointments={appointments} />

      {/* Recent Appointments */}
      <RecentAppointments appointments={appointments} />
    </div>
  );
}
