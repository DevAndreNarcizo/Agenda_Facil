import { StatsCard } from "@/components/ui/stats-card";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { AppointmentsChart } from "@/components/dashboard/appointments-chart";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { RecentAppointments } from "@/components/dashboard/recent-appointments";
import { useAppointments } from "@/hooks/use-appointments";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { Calendar, DollarSign, TrendingUp, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { NewAppointmentModal } from "@/components/dashboard/new-appointment-modal";

// Página Inicial do Dashboard
// Exibe uma visão geral do negócio com métricas, gráficos e agenda
export default function DashboardHome() {
  // Hooks para buscar dados
  const { appointments, loading } = useAppointments(); // Busca agendamentos do Supabase
  const { profile } = useAuth(); // Dados do usuário logado
  const stats = useDashboardStats(appointments); // Calcula estatísticas baseadas nos agendamentos

  // Estado de Carregamento (Loading State)
  // Exibe Skeletons enquanto os dados estão sendo buscados para evitar layout shift
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton do Header */}
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>

        {/* Skeleton dos Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>

        {/* Skeleton dos Gráficos */}
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[350px] w-full rounded-xl" />
          <Skeleton className="h-[350px] w-full rounded-xl" />
        </div>
        
        {/* Skeleton do Calendário */}
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  // Verifica permissões de administrador
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-slide-up">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Dashboard
          </h2>
          <p className="text-muted-foreground">
            Bem-vindo de volta! Aqui está um resumo do seu negócio.
          </p>
        </div>
        <NewAppointmentModal onAppointmentCreated={() => {}} />
      </div>

      {/* Grid de Cards de Estatísticas (KPIs) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-slide-up [animation-delay:100ms]">
        {/* Card: Agendamentos Hoje */}
        <StatsCard
          title="Agendamentos Hoje"
          value={stats.todayAppointments}
          icon={Calendar}
          description={`${stats.todayAppointments} agendamento${stats.todayAppointments !== 1 ? 's' : ''} para hoje`}
          trend="neutral"
        />
        
        {/* Card: Total do Mês */}
        <StatsCard
          title="Agendamentos do Mês"
          value={stats.monthAppointments}
          icon={Users}
          description={`Total de agendamentos em ${new Date().toLocaleDateString('pt-BR', { month: 'long' })}`}
          trend="up"
        />
        
        {/* Card: Receita (Apenas Admin) */}
        {isAdmin && (
          <StatsCard
            title="Receita do Mês"
            value={`R$ ${stats.monthRevenue.toFixed(2)}`}
            icon={DollarSign}
            description="Receita de agendamentos completados"
            trend="up"
          />
        )}
        
        {/* Card: Taxa de Conclusão */}
        <StatsCard
          title="Taxa de Conclusão"
          value={`${stats.completedRate}%`}
          icon={TrendingUp}
          description={`${stats.completedRate}% dos agendamentos foram concluídos`}
          // Lógica visual para indicar se a taxa está boa (verde), média (cinza) ou ruim (vermelha)
          trend={stats.completedRate >= 80 ? "up" : stats.completedRate >= 50 ? "neutral" : "down"}
        />
      </div>

      {/* Grid de Gráficos */}
      <div className="grid gap-4 md:grid-cols-2 animate-slide-up [animation-delay:200ms]">
        {/* Gráfico de Barras: Agendamentos por dia */}
        <AppointmentsChart appointments={appointments} />
        
        {/* Gráfico de Linha: Receita acumulada (Apenas Admin) */}
        {isAdmin && <RevenueChart appointments={appointments} />}
      </div>

      {/* Visualização de Calendário */}
      <div className="animate-slide-up [animation-delay:300ms]">
        <CalendarView appointments={appointments} />
      </div>

      {/* Lista de Agendamentos Recentes */}
      <div className="animate-slide-up [animation-delay:400ms]">
        <RecentAppointments appointments={appointments} />
      </div>
    </div>
  );
}
