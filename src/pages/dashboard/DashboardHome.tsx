import { useState } from "react";
import { StatsCard } from "@/components/ui/stats-card";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { AppointmentsChart } from "@/components/dashboard/appointments-chart";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { RecentAppointments } from "@/components/dashboard/recent-appointments";
import { useAppointments } from "@/hooks/use-appointments";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { Calendar, DollarSign, TrendingUp, Users, Download, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { NewAppointmentModal } from "@/components/dashboard/new-appointment-modal";
import { Input } from "@/components/ui/input";
import { ServiceManager } from "@/components/dashboard/service-manager";
import { PromotionsManager } from "@/components/dashboard/promotions/promotions-manager";
import { WaitlistDialog } from "@/components/dashboard/waitlist-dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useReviews } from "@/hooks/use-reviews";

// Página Inicial do Dashboard
// Exibe uma visão geral do negócio com métricas, gráficos e agenda
export default function DashboardHome() {
  // Hooks para buscar dados
  const { appointments, loading, updateAppointmentStatus, updateAppointment } = useAppointments(); // Busca agendamentos do Supabase
  const { profile } = useAuth(); // Dados do usuário logado
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Filter appointments
  const filteredAppointments = appointments.filter(apt => {
    const matchesSearch = apt.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = useDashboardStats(appointments); // Keep stats based on ALL appointments for accuracy
  const { averageRating, totalReviews } = useReviews();

  const handleExport = () => {
    const headers = ["Cliente", "Telefone", "Serviço", "Preço", "Data", "Hora", "Status"];
    const csvContent = [
      headers.join(","),
      ...appointments.map(apt => [
        `"${apt.customer_name}"`,
        `"${apt.customer_phone}"`,
        `"${apt.service?.name || ""}"`,
        apt.service?.price || 0,
        format(new Date(apt.start_time), "dd/MM/yyyy"),
        format(new Date(apt.start_time), "HH:mm"),
        apt.status
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `agendamentos_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <ServiceManager />
          <PromotionsManager />
          <WaitlistDialog />
          <NewAppointmentModal onAppointmentCreated={() => {}} />
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 animate-slide-up [animation-delay:50ms]">
        <Input
          placeholder="Buscar cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="sm:w-[300px]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="all">Todos os Status</option>
          <option value="pending">Pendente</option>
          <option value="confirmed">Confirmado</option>
          <option value="completed">Concluído</option>
          <option value="cancelled">Cancelado</option>
        </select>
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

        {/* Card: Avaliação Média */}
        <StatsCard
          title="Avaliação Média"
          value={averageRating.toFixed(1)}
          icon={Star}
          description={`Baseado em ${totalReviews} avaliações`}
          trend="neutral"
        />
      </div>

      {/* Grid de Gráficos */}
      <div className="grid gap-4 md:grid-cols-2 animate-slide-up [animation-delay:200ms]">
        {/* Gráfico de Barras: Agendamentos por dia */}
        <AppointmentsChart appointments={filteredAppointments} />
        
        {/* Gráfico de Linha: Receita acumulada (Apenas Admin) */}
        {isAdmin && <RevenueChart appointments={filteredAppointments} />}
      </div>

      {/* Visualização de Calendário */}
      <div className="animate-slide-up [animation-delay:300ms]">
        <CalendarView 
          appointments={filteredAppointments} 
          onAppointmentUpdate={updateAppointment}
        />
      </div>

      {/* Lista de Agendamentos Recentes */}
      <div className="animate-slide-up [animation-delay:400ms]">
        <RecentAppointments 
          appointments={filteredAppointments} 
          onUpdateStatus={updateAppointmentStatus}
        />
      </div>
    </div>
  );
}
