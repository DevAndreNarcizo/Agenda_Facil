import { StatsCard } from "@/components/ui/stats-card";
import { useAppointments } from "@/hooks/use-appointments";
import {
  formatInSaoPaulo,
  isSameDayInSaoPaulo,
  useDashboardStats,
} from "@/hooks/use-dashboard-stats";
import { useEmployees } from "@/hooks/use-employees";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

/**
 * Exibe as métricas e a agenda diária no fuso operacional America/Sao_Paulo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function DashboardHome() {
  const { profile } = useAuth();
  const { appointments, loading: loadingApts } = useAppointments();
  const { employees, loading: loadingEmps } = useEmployees();
  const navigate = useNavigate();
  
  const stats = useDashboardStats(appointments);
  const loading = loadingApts || loadingEmps;

  const todayApts = appointments.filter(
    (appointment) => appointment.status !== "cancelled"
      && isSameDayInSaoPaulo(new Date(appointment.start_time)),
  );

  if (loading) {
    return (
      <div className="space-y-12 animate-pulse p-8 max-w-7xl mx-auto">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-stitch-surface-container rounded-full" />
          <div className="h-10 w-64 bg-stitch-surface-container rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 w-full rounded-[2rem] bg-stitch-surface-container" />
          ))}
        </div>
        <div className="h-[600px] w-full rounded-[2.5rem] bg-stitch-surface-container/50 overflow-hidden relative">
           <div className="absolute inset-x-0 top-0 h-20 bg-stitch-surface-container" />
           <div className="p-8 mt-20 space-y-6">
             <div className="h-12 w-full bg-stitch-surface-container/50 rounded-2xl" />
             <div className="h-12 w-full bg-stitch-surface-container/50 rounded-2xl" />
             <div className="h-12 w-full bg-stitch-surface-container/50 rounded-2xl" />
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-20 max-w-7xl mx-auto p-8">
      <div>
        <p className="text-stitch-on-surface-variant text-sm font-medium mb-1 uppercase tracking-wider">Visão Geral</p>
        <h1 className="font-headline text-4xl font-black tracking-tight text-stitch-on-surface">Bem-vindo, {profile?.full_name?.split(' ')[0] || 'Usuário'}</h1>
      </div>
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Agendamentos Hoje"
          value={stats.todayAppointments}
          icon="event_available"
          colorClass="border-stitch-primary"
          description={`${stats.todayAppointments} agendamentos`}
        />
        <StatsCard
          title="Total no Mês"
          value={stats.monthAppointments}
          icon="person_add"
          colorClass="border-stitch-secondary"
          description="Acompanhamento mensal"
        />
        <StatsCard
          title="Faturamento Previsto"
          value={`R$ ${stats.monthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon="payments"
          colorClass="border-stitch-tertiary"
          description="Baseado em agendamentos pagos"
        />
        <StatsCard
          title="Capacidade"
          value={`${stats.completedRate}%`}
          icon="speed"
          colorClass="border-stitch-outline"
          description="Status atual"
        />
      </div>

      {/* Agenda Visualization Section */}
      <div className="bg-stitch-surface-container-low/30 p-8 rounded-[32px] shadow-sm border border-stitch-outline-variant/10">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <h3 className="text-2xl font-black font-headline flex items-center gap-3 text-stitch-on-surface">
            <span className="material-symbols-outlined text-stitch-primary text-3xl">calendar_month</span>
            Agenda do Dia - {formatInSaoPaulo(new Date(), { day: "2-digit", month: "long" })}
          </h3>
          <div className="flex bg-stitch-surface-container-lowest p-1.5 rounded-2xl shadow-sm border border-stitch-outline-variant/5">
            <Button variant="default" size="sm" onClick={() => navigate('/dashboard/calendar?view=day')} className="rounded-xl shadow-none font-black text-[10px] tracking-widest uppercase">Hoje</Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/calendar?view=week')} className="rounded-xl text-stitch-on-surface-variant font-black text-[10px] tracking-widest uppercase">Semana</Button>
          </div>
        </div>

        {/* Professional Columns Grid - Dynamic from Employees */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-x-auto pb-4">
          {employees.length === 0 ? (
            <div className="col-span-full py-20 text-center text-stitch-on-surface-variant opacity-60 italic">
                Nenhum profissional cadastrado. Adicione-os na aba "Equipe".
            </div>
          ) : (
            employees.map((emp) => (
              <div key={emp.id} className="space-y-6 min-w-[280px]">
                <div className="flex items-center gap-4 mb-2 p-2">
                  <Avatar className="h-12 w-12 border-2 border-stitch-surface-container-highest shadow-sm">
                    <AvatarFallback className="font-black bg-stitch-primary/10 text-stitch-primary uppercase">
                       {emp.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-black text-sm text-stitch-on-surface">{emp.full_name}</p>
                    <p className="text-[10px] text-stitch-on-surface-variant font-black uppercase tracking-wider opacity-60">{emp.role === 'admin' ? 'Administrador' : 'Profissional'}</p>
                  </div>
                </div>
                
                {todayApts.filter(apt => apt.employee_id === emp.id).length === 0 ? (
                  <div className="p-10 border-4 border-dashed border-stitch-outline-variant/10 rounded-[28px] flex flex-col items-center justify-center text-stitch-on-surface-variant opacity-40">
                    <p className="text-xs font-bold uppercase tracking-widest">Sem agendamentos</p>
                  </div>
                ) : (
                  todayApts.filter(apt => apt.employee_id === emp.id).map(apt => (
                    <Card key={apt.id} className="p-5 border-l-4 border-stitch-secondary bg-stitch-surface-container-lowest group hover:scale-[1.02] transition-all border-y-0 border-r-0 rounded-2xl shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <p className="text-[10px] font-black text-stitch-primary uppercase tracking-tight">
                          {formatInSaoPaulo(new Date(apt.start_time), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} - {formatInSaoPaulo(new Date(apt.end_time), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
                        </p>
                        {apt.status === 'completed' && (
                          <span className="material-symbols-outlined text-emerald-500 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        )}
                      </div>
                      <h4 className="font-black text-stitch-on-surface text-lg">{apt.customer_name}</h4>
                      <p className="text-xs text-stitch-on-surface-variant mb-5 font-bold italic opacity-70">{apt.service?.name}</p>
                      <div className="flex gap-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => navigate('/dashboard/calendar')}
                          className="flex-1 text-[10px] font-black tracking-widest uppercase rounded-xl bg-stitch-surface-container hover:bg-stitch-primary hover:text-white transition-colors"
                        >
                          GERENCIAR
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
        <Card className="p-8 bg-stitch-surface-container-low/30 backdrop-blur-xl border border-stitch-outline-variant/10 rounded-[32px] shadow-sm">
          <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-stitch-on-surface">
            <span className="material-symbols-outlined text-stitch-primary text-2xl">history</span>
            Atividade Recente
          </h3>
          <div className="space-y-4">
            {appointments.slice(0, 3).map((apt) => (
              <div key={apt.id} className="flex items-start gap-4 p-4 hover:bg-stitch-surface-container/30 rounded-2xl transition-all cursor-pointer group border border-transparent hover:border-stitch-outline-variant/10">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-stitch-primary/10 text-stitch-primary">
                  <span className="material-symbols-outlined text-lg">event</span>
                </div>
                <div>
                  <p className="text-sm font-black text-stitch-on-surface">Agendamento de {apt.customer_name}</p>
                  <p className="text-[10px] text-stitch-on-surface-variant uppercase tracking-wider mt-1 opacity-50 font-black">
                     Status: {apt.status === 'confirmed' ? 'Confirmado' : apt.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="bg-stitch-primary text-white p-10 rounded-[40px] overflow-hidden relative shadow-2xl shadow-stitch-primary/20 flex flex-col justify-center group cursor-pointer" onClick={() => navigate('/dashboard/subscription')}>
          <div className="relative z-10 space-y-4">
            <div className="bg-white/20 w-16 h-16 rounded-3xl flex items-center justify-center mb-6 backdrop-blur-md group-hover:scale-110 transition-transform duration-500">
              <span className="material-symbols-outlined text-4xl text-white">card_membership</span>
            </div>
            <h3 className="text-3xl font-black leading-tight text-white uppercase tracking-tighter">Upgrade Premium</h3>
            <p className="text-sm font-bold opacity-80 max-w-xs leading-relaxed text-white">Libere agendamentos ilimitados e notificações WhatsApp profissionais.</p>
            <Button className="w-fit bg-white text-stitch-primary hover:bg-white/90 mt-4 py-6 px-10 text-[10px] tracking-[0.2em] font-black rounded-2xl transition-all shadow-xl group-hover:translate-x-2 uppercase">VER PLANOS</Button>
          </div>
          <div className="absolute top-0 right-0 p-10">
            <span className="material-symbols-outlined text-[120px] opacity-10 rotate-12 text-white">crown</span>
          </div>
        </div>
      </div>
    </div>
  );
}
