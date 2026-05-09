import { StatsCard } from "@/components/ui/stats-card";
import { useAppointments } from "@/hooks/use-appointments";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useEmployees } from "@/hooks/use-employees";
import { format, isSameDay } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// Página Inicial do Dashboard
export default function DashboardHome() {
  const { appointments, loading: loadingApts } = useAppointments();
  const { employees, loading: loadingEmps } = useEmployees();
  const navigate = useNavigate();
  
  const stats = useDashboardStats(appointments);
  const loading = loadingApts || loadingEmps;

  // Filtrar agendamentos de hoje
  const todayApts = appointments.filter(apt => isSameDay(new Date(apt.start_time), new Date()));

  if (loading) {
    return (
      <div className="mx-auto flex max-w-7xl animate-pulse flex-col gap-6 p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 w-full rounded-3xl bg-[var(--af-surface-med)]" />
          ))}
        </div>
        <div className="h-[520px] w-full rounded-3xl bg-[var(--af-surface-med)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl animate-in flex-col gap-[22px] p-6 duration-500 md:p-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Agendamentos Hoje"
          value={stats.todayAppointments}
          icon="event_available"
          colorClass="border-stitch-primary"
          trend="up"
          description="+18%"
        />
        <StatsCard
          title="Total no Mês"
          value={stats.monthAppointments}
          icon="groups"
          colorClass="border-stitch-secondary"
          trend="up"
          description="+24%"
        />
        <StatsCard
          title="Faturamento"
          value={`R$ ${stats.monthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon="payments"
          colorClass="border-stitch-tertiary"
          trend="up"
          description="+12%"
        />
        <StatsCard
          title="Taxa ocupação"
          value={`${stats.completedRate}%`}
          icon="speed"
          colorClass="border-stitch-outline"
          trend={stats.completedRate > 70 ? "up" : "neutral"}
          description="Status"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.45fr_1fr]">
        <section className="af-card p-6">
          <div className="af-section-h">
            <div>
              <div className="af-eb text-[var(--af-primary)] opacity-85">Agenda · Hoje</div>
              <h3 className="m-0 mt-1 font-headline text-[22px] font-black tracking-[-0.02em] text-[var(--af-on-surface)]">
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </h3>
              <p className="mt-1 flex items-center text-xs font-semibold text-[var(--af-on-surface-variant)] opacity-70">
                <span className="af-pulse-dot mr-1.5 inline-block bg-[var(--af-success)]" />
                {todayApts.length} agendamentos hoje · {employees.length} profissionais
              </p>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => navigate('/dashboard/calendar?view=day')} className="af-btn af-btn-primary af-btn-tiny">Hoje</button>
              <button onClick={() => navigate('/dashboard/calendar?view=week')} className="af-btn af-btn-ghost af-btn-tiny">Semana</button>
              <button onClick={() => navigate('/dashboard/calendar?view=month')} className="af-btn af-btn-ghost af-btn-tiny">Mês</button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
          {employees.length === 0 ? (
            <div className="py-16 text-center text-sm font-semibold text-[var(--af-on-surface-variant)] opacity-60">
                Nenhum profissional cadastrado. Adicione-os na aba "Equipe".
            </div>
          ) : (
            todayApts.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-[var(--af-outline-variant)]/30 bg-[var(--af-surface-low)] px-6 py-12 text-center">
                <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--af-on-surface-variant)] opacity-60">Sem agendamentos para hoje</p>
              </div>
            ) : todayApts.slice(0, 6).map((apt) => (
              <button
                key={apt.id}
                onClick={() => navigate('/dashboard/calendar')}
                className="group flex w-full items-center gap-4 rounded-[14px] border border-[var(--af-divider)] border-l-4 border-l-[var(--af-secondary)] bg-[var(--af-surface-lowest)] px-[18px] py-3.5 text-left transition-all hover:border-[var(--af-outline-variant)] hover:shadow-[var(--af-shadow-md)]"
              >
                <div className="af-num min-w-[88px] font-headline text-[15px] font-black tracking-[-0.02em] text-[var(--af-secondary)]">
                  {format(new Date(apt.start_time), 'HH:mm')}
                </div>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-[var(--af-primary-soft)] text-xs font-black text-[var(--af-primary)]">
                    {apt.customer_name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'CL'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-extrabold text-[var(--af-on-surface)]">{apt.customer_name}</div>
                  <div className="mt-0.5 truncate text-xs font-medium text-[var(--af-on-surface-variant)] opacity-70">
                    {apt.service?.name || "Serviço"} · {employees.find(emp => emp.id === apt.employee_id)?.full_name || "Profissional"}
                  </div>
                </div>
                <span className={cn(
                  "af-badge",
                  apt.status === "confirmed" ? "af-badge-success" :
                  apt.status === "cancelled" ? "af-badge-error" :
                  apt.status === "completed" ? "af-badge-neutral" :
                  "af-badge-warn"
                )}>
                  {apt.status === "confirmed" ? "Confirmado" : apt.status === "completed" ? "Concluído" : apt.status === "cancelled" ? "Cancelado" : "Aguardando"}
                </span>
              </button>
            ))
          )}
          </div>

          <button className="af-btn af-btn-soft mt-3 w-full" onClick={() => navigate('/dashboard/calendar')}>
            Ver agenda completa
            <span className="material-symbols-outlined text-lg">arrow_right_alt</span>
          </button>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="af-card p-[22px]">
            <div className="af-section-h mb-3">
              <div>
                <div className="af-eb text-[var(--af-primary)] opacity-85">Receita</div>
                <h3 className="m-0 mt-1 font-headline text-lg font-black tracking-[-0.02em]">Este mês</h3>
              </div>
              <div className="text-right">
                <div className="af-num font-headline text-[22px] font-black tracking-[-0.02em] text-[var(--af-on-surface)]">
                  R$ {stats.monthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] font-extrabold tracking-wide text-[var(--af-success)]">+12% vs mês anterior</div>
              </div>
            </div>
            <div className="flex h-[180px] items-end justify-between gap-3 pt-2">
              {[38, 52, 44, 66, 74, 92, 58].map((height, index) => (
                <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div className="text-[10px] font-extrabold text-[var(--af-on-surface-variant)] opacity-60">{["S","T","Q","Q","S","S","D"][index]}</div>
                  <div
                    className={cn("w-full rounded-t-lg rounded-b", index === 5 ? "bg-gradient-to-b from-[var(--af-primary)] to-[var(--af-primary-hover)] shadow-[0_8px_18px_rgba(83,67,212,0.30)]" : "bg-[var(--af-surface-med)]")}
                    style={{ height: `${height}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[var(--af-primary)] to-[var(--af-primary-deep)] p-[26px] text-white shadow-[var(--af-shadow-glow)]">
            <span className="material-symbols-outlined absolute -bottom-7 -right-4 rotate-12 text-[180px] opacity-10" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            <div className="relative">
              <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-[14px] bg-white/20 backdrop-blur">
                <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
              </div>
              <div className="af-eb opacity-75">Upgrade Premium</div>
              <h3 className="mt-1 font-headline text-[22px] font-black leading-tight tracking-[-0.02em]">Mais conversão.<br/>Mais retenção.</h3>
              <p className="mt-2 text-xs leading-relaxed opacity-80">Lembretes WhatsApp, relatórios avançados e sub-contas ilimitadas.</p>
              <button onClick={() => navigate('/dashboard/subscription')} className="mt-3.5 inline-flex items-center gap-1.5 rounded-[10px] bg-white px-4 py-2.5 text-xs font-black tracking-wide text-[var(--af-primary)]">
                VER PLANOS
                <span className="material-symbols-outlined text-base">arrow_right_alt</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className="grid grid-cols-1 gap-4 pb-10 lg:grid-cols-2">
        <Card className="af-card rounded-[24px] border-[var(--af-divider)] bg-[var(--af-surface-lowest)] p-[22px] shadow-none">
          <div className="af-section-h mb-3.5">
            <div>
              <div className="af-eb text-[var(--af-primary)] opacity-85">Atividade</div>
              <h3 className="m-0 mt-1 font-headline text-lg font-black tracking-[-0.02em]">Últimas ações</h3>
            </div>
          </div>
          <div>
            {appointments.slice(0, 4).map((apt, index) => (
              <div key={apt.id} className={cn("flex items-center gap-3 py-3", index > 0 && "border-t border-[var(--af-divider)]")}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--af-primary-soft)] text-[var(--af-primary)]">
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>event</span>
                </div>
                <div>
                  <p className="text-[13px] font-extrabold text-[var(--af-on-surface)]">Agendamento de {apt.customer_name}</p>
                  <p className="mt-0.5 text-xs font-medium text-[var(--af-on-surface-variant)] opacity-70">
                     Status: {apt.status === 'confirmed' ? 'Confirmado' : apt.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="af-card rounded-[24px] border-[var(--af-divider)] bg-[var(--af-surface-lowest)] p-[22px] shadow-none">
          <div className="af-section-h mb-3.5">
            <div>
              <div className="af-eb text-[var(--af-primary)] opacity-85">Equipe</div>
              <h3 className="m-0 mt-1 font-headline text-lg font-black tracking-[-0.02em]">Profissionais ativos</h3>
            </div>
          </div>
          <div className="space-y-2">
            {employees.slice(0, 5).map((emp) => (
              <div key={emp.id} className="flex items-center gap-3 rounded-[14px] bg-[var(--af-surface-low)] p-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-[var(--af-primary-soft)] text-xs font-black text-[var(--af-primary)]">
                    {emp.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-[var(--af-on-surface)]">{emp.full_name}</p>
                  <p className="text-xs font-medium text-[var(--af-on-surface-variant)] opacity-70">{emp.role === 'admin' ? 'Administrador' : 'Profissional'}</p>
                </div>
                <span className="af-badge af-badge-primary">Ativo</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
