import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useBookingSourceMetrics } from '@/hooks/use-booking-source-metrics';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { StatsCard } from '@/components/ui/stats-card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const STITCH_COLORS = {
  primary: '#5343d4',
  secondary: '#00616f',
  tertiary: '#ae5b70',
  error: '#ba1a1a',
  surfaceVariant: '#474554',
  outline: '#c8c4d7'
};

const PIE_COLORS = [STITCH_COLORS.primary, STITCH_COLORS.secondary, STITCH_COLORS.tertiary, '#6d5fef', '#3fe1fd'];

type PeriodType = 'monthly' | 'annual';

export default function AnalyticsPage() {
  const { profile } = useAuth();
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number }[]>([]);
  const [topServices, setTopServices] = useState<{ service_name: string; count: number }[]>([]);
  const [peakHours, setPeakHours] = useState<{ hour: string; appointments: number }[]>([]);
  const [stats, setStats] = useState({ total_appointments: 0, total_customers: 0, total_revenue: 0, avg_ticket: 0 });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('monthly');
  const {
    error: bookingSourceError,
    isLoading: isLoadingBookingSources,
    metrics: bookingSourceMetrics,
    totalBookings,
  } = useBookingSourceMetrics();

  useEffect(() => {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organization_id]);

  const fetchAnalytics = async () => {
    const organizationId = profile?.organization_id;
    if (!organizationId) {
      return;
    }

    try {
      const [revenueRes, servicesRes, hoursRes, statsRes] = await Promise.all([
        supabase.rpc('get_monthly_revenue', { organization_id: organizationId }),
        supabase.rpc('get_top_services', { organization_id: organizationId }),
        supabase.rpc('get_peak_hours', { organization_id: organizationId }),
        supabase.rpc('get_dashboard_stats', { organization_id: organizationId })
      ]);

      if (revenueRes.data) setMonthlyRevenue(revenueRes.data);
      if (servicesRes.data) setTopServices(servicesRes.data);
      if (hoursRes.data) setPeakHours(hoursRes.data);
      if (statsRes.data && statsRes.data[0]) setStats(statsRes.data[0]);
    } catch {
      toast.error('Erro ao carregar dados de analytics.');
    } finally {
      setLoading(false);
    }
  };

  // Agrupar dados por ano quando period = annual
  const revenueData = useMemo(() => {
    if (period === 'annual' && monthlyRevenue.length > 0) {
      const annualMap = new Map<string, number>();
      for (const item of monthlyRevenue) {
        const year = item.month?.substring(0, 4) || 'N/A';
        annualMap.set(year, (annualMap.get(year) || 0) + item.revenue);
      }
      return Array.from(annualMap.entries()).map(([month, revenue]) => ({ month, revenue }));
    }
    return monthlyRevenue;
  }, [monthlyRevenue, period]);

  // Gerar insight dinâmico baseado nos dados reais
  const dynamicInsight = useMemo(() => {
    if (peakHours.length === 0) return { title: "Colete mais dados", message: "Continue registrando agendamentos para gerar insights de performance." };

    const sorted = [...peakHours].sort((a, b) => b.appointments - a.appointments);
    const peakHour = sorted[0];
    const lowHour = sorted[sorted.length - 1];

    return {
      title: "Insight de Performance",
      message: `Seus dados mostram que o horário de pico é às ${peakHour.hour}h com ${peakHour.appointments} atendimentos. O horário mais calmo é às ${lowHour.hour}h. Considere redistribuir profissionais para otimizar o fluxo.`
    };
  }, [peakHours]);

  if (loading) {
    return (
      <div className="space-y-12 p-8 max-w-7xl mx-auto animate-pulse">
        <div className="h-12 w-64 bg-stitch-surface-container rounded-2xl mb-8" />
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-stitch-surface-container rounded-[2rem]" />)}
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 h-[450px] bg-stitch-surface-container rounded-[2.5rem]" />
          <div className="h-[450px] bg-stitch-surface-container rounded-[2.5rem]" />
        </div>
      </div>
    );
  }

  if (!profile?.organization_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="w-20 h-20 bg-stitch-primary/10 text-stitch-primary rounded-[2rem] flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl">analytics</span>
        </div>
        <h2 className="font-headline font-black text-2xl text-stitch-on-surface">Analytics indisponível</h2>
        <p className="text-stitch-on-surface-variant font-medium max-w-md">
          Não foi possível carregar os dados de analytics. Verifique se sua organização está configurada corretamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12 p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-stitch-on-surface-variant text-sm font-medium mb-1 uppercase tracking-wider">Business Intelligence</p>
          <h1 className="font-headline text-4xl font-black tracking-tight text-stitch-on-surface">Analytics & Performance</h1>
        </div>
        <div className="flex bg-stitch-surface-container rounded-2xl p-1 shadow-inner">
          <button
            className={`px-6 py-2 rounded-xl font-black text-sm transition-all ${
              period === 'monthly'
                ? 'bg-stitch-surface-container-lowest text-stitch-primary shadow-sm scale-[1.02]'
                : 'text-stitch-on-surface-variant opacity-60 hover:opacity-100'
            }`}
            onClick={() => setPeriod('monthly')}
          >
            Mensal
          </button>
          <button
            className={`px-6 py-2 rounded-xl font-black text-sm transition-all ${
              period === 'annual'
                ? 'bg-stitch-surface-container-lowest text-stitch-primary shadow-sm scale-[1.02]'
                : 'text-stitch-on-surface-variant opacity-60 hover:opacity-100'
            }`}
            onClick={() => setPeriod('annual')}
          >
            Anual
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Agendamentos"
          value={stats.total_appointments}
          icon="event_available"
          description="Total concluído"
          trend="up"
          colorClass="border-stitch-primary"
        />
        <StatsCard
          title="Novos Clientes"
          value={stats.total_customers}
          icon="person_add"
          description="Base cadastrada"
          trend="up"
          colorClass="border-stitch-secondary"
        />
        <StatsCard
          title="Receita bruta"
          value={`R$ ${Number(stats.total_revenue).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
          icon="payments"
          description="Serviços finalizados"
          trend="up"
          colorClass="border-stitch-tertiary"
        />
        <StatsCard
          title="Ticket Médio"
          value={`R$ ${Number(stats.avg_ticket).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
          icon="trending_up"
          description="Média por venda"
          trend="neutral"
          colorClass="border-stitch-primary-container"
        />
      </div>

      <Card className="rounded-[2.5rem] border border-stitch-outline-variant/10 bg-stitch-surface-container-low/30 p-8 shadow-sm">
        <CardHeader className="mb-6 flex flex-row items-start justify-between gap-4 p-0">
          <div>
            <CardTitle className="font-headline text-2xl font-black text-stitch-on-surface">Reservas por canal</CardTitle>
            <CardDescription className="mt-1 text-sm font-medium text-stitch-on-surface-variant">Origem registrada em todos os agendamentos da organização.</CardDescription>
          </div>
          <span className="rounded-xl bg-stitch-primary/10 px-4 py-2 text-sm font-black text-stitch-primary">{totalBookings} reservas</span>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingBookingSources ? (
            <p aria-live="polite" className="text-sm text-stitch-on-surface-variant">Carregando canais de aquisição...</p>
          ) : bookingSourceError ? (
            <p role="alert" className="text-sm text-stitch-error">Não foi possível carregar as reservas por canal.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left">
                <caption className="sr-only">Quantidade e participação das reservas por canal de origem</caption>
                <thead className="border-b border-stitch-outline-variant/20 text-xs uppercase tracking-wider text-stitch-on-surface-variant">
                  <tr>
                    <th className="px-3 py-3 font-black" scope="col">Canal</th>
                    <th className="px-3 py-3 text-right font-black" scope="col">Reservas</th>
                    <th className="px-3 py-3 text-right font-black" scope="col">Participação</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingSourceMetrics.map((metric) => (
                    <tr key={metric.source} className="border-b border-stitch-outline-variant/10 last:border-0">
                      <th className="px-3 py-3 font-bold text-stitch-on-surface" scope="row">{metric.label}</th>
                      <td className="px-3 py-3 text-right font-black text-stitch-on-surface">{metric.count}</td>
                      <td className="px-3 py-3 text-right font-medium text-stitch-on-surface-variant">{metric.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Revenue Chart */}
        <Card className="lg:col-span-2 rounded-[2.5rem] border border-stitch-outline-variant/10 shadow-sm overflow-hidden bg-stitch-surface-container-low/30 p-8">
          <CardHeader className="p-0 mb-8 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-black font-headline text-stitch-on-surface">
                {period === 'monthly' ? 'Evolução do Faturamento' : 'Faturamento Anual'}
              </CardTitle>
              <CardDescription className="text-sm font-medium text-stitch-on-surface-variant">
                {period === 'monthly' ? 'Comparativo mensal de receita bruta' : 'Receita acumulada por ano'}
              </CardDescription>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary">
              <span className="material-symbols-outlined">analytics</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ResponsiveContainer width="100%" height={380}>
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STITCH_COLORS.primary} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={STITCH_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#78758620" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: STITCH_COLORS.outline, fontWeight: 'bold', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: STITCH_COLORS.outline, opacity: 0.5, fontSize: 12 }}
                  tickFormatter={(v) => `R$${v / 1000}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#1d2023', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  itemStyle={{ color: STITCH_COLORS.primary, fontWeight: 'bold' }}
                  labelStyle={{ color: '#fff', marginBottom: '4px' }}
                  formatter={(value) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Faturamento']}
                />
                <Area type="monotone" dataKey="revenue" stroke={STITCH_COLORS.primary} strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Services Chart */}
        <Card className="rounded-[2.5rem] border border-stitch-outline-variant/10 shadow-sm overflow-hidden bg-stitch-surface-container-low/30 p-8">
          <CardHeader className="p-0 mb-8">
            <CardTitle className="text-2xl font-black font-headline text-stitch-on-surface">Mix de Serviços</CardTitle>
            <CardDescription className="text-sm font-medium text-stitch-on-surface-variant">Participação por categoria</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={topServices}
                  dataKey="count"
                  nameKey="service_name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                >
                  {topServices.map((_entry: unknown, index: number) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#1d2023', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3 mt-4">
              {topServices.map((service, index) => (
                <div key={service.service_name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span className="text-sm font-bold text-stitch-on-surface-variant truncate max-w-[120px]">{service.service_name}</span>
                  </div>
                  <span className="text-sm font-black text-stitch-on-surface">{service.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Row */}
      <div className="grid gap-8 lg:grid-cols-2 pb-10">
        <Card className="rounded-[2.5rem] bg-stitch-surface-container-low/30 border border-stitch-outline-variant/10 p-8">
          <CardHeader className="p-0 mb-8">
            <CardTitle className="text-2xl font-black font-headline tracking-tight text-stitch-on-surface">Horários de Pico</CardTitle>
            <CardDescription className="text-sm font-medium text-stitch-on-surface-variant">Fluxo de clientes por hora do dia</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={peakHours}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#78758620" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold', fill: STITCH_COLORS.outline }} />
                <YAxis hide />
                <Tooltip cursor={{ fill: '#78758620', radius: 8 }} contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#1d2023', color: '#fff' }} />
                <Bar dataKey="appointments" fill={STITCH_COLORS.secondary} radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] bg-stitch-tertiary-container text-white p-10 shadow-2xl relative overflow-hidden group border-0">
          <div className="relative z-10 max-w-sm">
            <h3 className="text-3xl font-black font-headline mb-4 tracking-tight leading-tight">{dynamicInsight.title}</h3>
            <p className="text-lg font-medium opacity-80 mb-8">
              {dynamicInsight.message}
            </p>
            <Button className="bg-white text-stitch-tertiary h-14 px-8 rounded-xl font-black text-lg hover:bg-stitch-surface-container transition-all">
              Otimizar Escala
            </Button>
          </div>
          <span className="material-symbols-outlined absolute right-[-5%] bottom-[-5%] text-[180px] opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-all duration-700">bolt</span>
        </Card>
      </div>
    </div>
  );
}
