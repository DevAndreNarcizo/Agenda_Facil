import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useBookingSourceMetrics } from "@/hooks/use-booking-source-metrics";
import { EmptyState, KpiStrip, Page, PageHeader, Panel, Segmented, Skeleton } from "@/components/panel/primitives";
import { formatDateKey } from "@/lib/agenda-time";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Period = "monthly" | "annual";

const MIX_COLORS = ["bg-af-accent", "bg-af-c2", "bg-af-c3", "bg-af-c4", "bg-af-ink3"];

interface AnalyticsData {
  revenue: { month: string; revenue: number }[];
  topServices: { service_name: string; count: number; revenue: number }[];
  peakHours: { hour: string; appointments: number }[];
  stats: { total_appointments: number; total_customers: number; total_revenue: number; avg_ticket: number };
}

/**
 * Carrega as métricas agregadas do servidor (RPCs SECURITY DEFINER com escopo da organização).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function useAnalytics(organizationId: string | null) {
  return useQuery({
    queryKey: ["analytics", organizationId],
    enabled: Boolean(organizationId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AnalyticsData> => {
      // As RPCs são SECURITY INVOKER e escopadas pela organização do usuário no servidor.
      const [revenue, services, hours, stats] = await Promise.all([
        supabase.rpc("get_monthly_revenue"),
        supabase.rpc("get_top_services"),
        supabase.rpc("get_peak_hours"),
        supabase.rpc("get_dashboard_stats"),
      ]);
      const failed = [revenue, services, hours, stats].find((result) => result.error);
      if (failed?.error) throw failed.error;
      return {
        revenue: [...(revenue.data ?? [])].sort((a, b) => a.month.localeCompare(b.month)).map((row) => ({ month: row.month, revenue: Number(row.revenue) })),
        topServices: (services.data ?? []).map((row) => ({ ...row, count: Number(row.count), revenue: Number(row.revenue) })),
        peakHours: [...(hours.data ?? [])].sort((a, b) => a.hour.localeCompare(b.hour)).map((row) => ({ hour: row.hour, appointments: Number(row.appointments) })),
        stats: stats.data?.[0] ?? { total_appointments: 0, total_customers: 0, total_revenue: 0, avg_ticket: 0 },
      };
    },
  });
}

/**
 * Gráfico de colunas leve (CSS) com rótulos; destaca a coluna indicada.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function BarChart({ bars, height, highlight, valueLabel }: {
  bars: { key: string; label: string; value: number }[];
  height: number;
  highlight: number;
  valueLabel?: (value: number) => string;
}) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const template = `repeat(${bars.length}, minmax(0, 1fr))`;
  return (
    <div className="flex flex-col gap-2">
      <div role="img" aria-label={bars.map((bar) => `${bar.label}: ${valueLabel ? valueLabel(bar.value) : bar.value}`).join("; ")} className="grid items-end gap-2.5 border-b border-af-line" style={{ gridTemplateColumns: template, height }}>
        {bars.map((bar, index) => (
          <div key={bar.key} className="flex h-full flex-col items-stretch justify-end gap-1.5">
            {valueLabel && <span className="text-center text-[11px] text-af-ink3">{valueLabel(bar.value)}</span>}
            <div
              title={valueLabel ? valueLabel(bar.value) : String(bar.value)}
              className={cn("rounded-t", index === highlight ? "bg-af-accent" : "bg-af-c4")}
              style={{ height: Math.max(2, Math.round((bar.value / max) * (height - (valueLabel ? 24 : 8)))) }}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: template }}>
        {bars.map((bar) => <span key={bar.key} className="truncate text-center text-[11px] text-af-ink3">{bar.label}</span>)}
      </div>
    </div>
  );
}

/**
 * Analytics: KPIs, evolução do faturamento (mensal/anual), mix de serviços, horários de pico e canais.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function AnalyticsPage() {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<Period>("monthly");
  const analytics = useAnalytics(profile?.organization_id ?? null);
  const channels = useBookingSourceMetrics();
  const data = analytics.data;

  const revenueBars = useMemo(() => {
    if (!data) return [];
    if (period === "monthly") {
      return data.revenue.slice(-12).map((row) => ({ key: row.month, label: formatDateKey(`${row.month}-15`, { month: "short" }), value: row.revenue }));
    }
    const byYear = new Map<string, number>();
    data.revenue.forEach((row) => byYear.set(row.month.slice(0, 4), (byYear.get(row.month.slice(0, 4)) ?? 0) + row.revenue));
    return [...byYear.entries()].map(([year, value]) => ({ key: year, label: year, value }));
  }, [data, period]);

  const revenueTotal = revenueBars.reduce((sum, bar) => sum + bar.value, 0);
  const mixTotal = data?.topServices.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const peak = data && data.peakHours.length > 0 ? [...data.peakHours].sort((a, b) => b.appointments - a.appointments) : [];
  const peakIndex = peak.length > 0 ? data!.peakHours.findIndex((row) => row.hour === peak[0].hour) : -1;

  if (analytics.isLoading) {
    return (
      <Page>
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-[106px]" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
          <Skeleton className="h-[320px]" />
          <Skeleton className="h-[320px]" />
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Desempenho"
        title="Analytics"
        actions={
          <Segmented label="Período" value={period} onChange={setPeriod} options={[{ value: "monthly", label: "Mensal" }, { value: "annual", label: "Anual" }]} />
        }
      />

      {analytics.error && <p role="alert" className="m-0 rounded-af bg-af-bad-soft px-4 py-3 text-[13px] text-af-bad">Não foi possível carregar os dados de analytics.</p>}

      <KpiStrip
        items={[
          { label: "Agendamentos", value: (data?.stats.total_appointments ?? 0).toLocaleString("pt-BR"), sub: "Atendimentos concluídos" },
          { label: "Clientes", value: (data?.stats.total_customers ?? 0).toLocaleString("pt-BR"), sub: "Base cadastrada" },
          { label: "Receita bruta", value: formatCurrency(Number(data?.stats.total_revenue ?? 0), { compact: true }), sub: "Serviços concluídos" },
          { label: "Ticket médio", value: formatCurrency(Number(data?.stats.avg_ticket ?? 0), { compact: true }), sub: "Por atendimento" },
        ]}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
        <Panel className="flex flex-col gap-5 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="m-0 text-[15px] font-semibold">{period === "monthly" ? "Evolução do faturamento" : "Faturamento anual"}</h2>
              <span className="text-xs text-af-ink3">{period === "monthly" ? "Receita realizada nos últimos 12 meses" : "Receita realizada por ano (últimos 24 meses)"}</span>
            </div>
            <span className="text-xl font-bold tracking-[-0.02em]">{formatCurrency(revenueTotal, { compact: true })}</span>
          </div>
          {revenueBars.length === 0 ? (
            <EmptyState icon="monitoring" title="Sem faturamento no período" description="Os atendimentos concluídos aparecem aqui." />
          ) : (
            <BarChart
              bars={revenueBars}
              height={220}
              highlight={revenueBars.length - 1}
              valueLabel={period === "annual" ? (value) => formatCurrency(value, { compact: true }) : undefined}
            />
          )}
        </Panel>

        <Panel className="flex flex-col gap-[18px] p-5">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-[15px] font-semibold">Mix de serviços</h2>
            <span className="text-xs text-af-ink3">Participação nos atendimentos</span>
          </div>
          {!data || data.topServices.length === 0 ? (
            <EmptyState icon="spa" title="Sem atendimentos ainda" />
          ) : (
            <>
              <div className="flex h-2 gap-0.5 overflow-hidden rounded">
                {data.topServices.map((row, index) => (
                  <div key={row.service_name} className={MIX_COLORS[index % MIX_COLORS.length]} style={{ width: `${(row.count / mixTotal) * 100}%` }} />
                ))}
              </div>
              <div className="flex flex-col gap-3">
                {data.topServices.map((row, index) => (
                  <div key={row.service_name} className="flex items-center gap-2.5 text-[13px]">
                    <span className={cn("h-2 w-2 rounded-sm", MIX_COLORS[index % MIX_COLORS.length])} />
                    <span className="min-w-0 flex-1 truncate text-af-ink2">{row.service_name}</span>
                    <span className="font-medium">{row.count}</span>
                    <span className="w-9 text-right text-af-ink3">{Math.round((row.count / mixTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
        <Panel className="flex flex-col gap-[18px] p-5">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-[15px] font-semibold">Horários de pico</h2>
            <span className="text-xs text-af-ink3">Atendimentos por hora do dia</span>
          </div>
          {!data || data.peakHours.length === 0 ? (
            <EmptyState icon="schedule" title="Colete mais dados" description="Continue registrando agendamentos para ver os horários de pico." />
          ) : (
            <>
              <BarChart bars={data.peakHours.map((row) => ({ key: row.hour, label: `${Number(row.hour.slice(0, 2))}h`, value: row.appointments }))} height={140} highlight={peakIndex} />
              <p className="m-0 border-t border-af-line pt-3.5 text-[13px] text-af-ink2 [text-wrap:pretty]">
                Pico às <strong className="font-semibold text-af-ink">{Number(peak[0].hour.slice(0, 2))}h</strong> com {peak[0].appointments} atendimentos
                {peak.length > 1 && <>; o horário mais calmo é às {Number(peak[peak.length - 1].hour.slice(0, 2))}h</>}. Considere redistribuir a equipe para equilibrar o fluxo.
              </p>
            </>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-baseline justify-between px-5 pb-3 pt-5">
            <h2 className="m-0 text-[15px] font-semibold">Reservas por canal</h2>
            <span className="text-xs text-af-ink3">{channels.totalBookings.toLocaleString("pt-BR")} reservas</span>
          </div>
          {channels.isLoading ? (
            <div className="px-5 pb-5"><Skeleton className="h-40" /></div>
          ) : channels.error ? (
            <p role="alert" className="m-0 px-5 pb-5 text-[13px] text-af-bad">Não foi possível carregar as reservas por canal.</p>
          ) : (
            [...channels.metrics].sort((a, b) => b.count - a.count).map((metric) => (
              <div key={metric.source} className="grid grid-cols-[minmax(0,1fr)_44px_40px] items-center gap-2 border-t border-af-line px-5 py-2.5 text-[13px]">
                <div className="flex flex-col gap-1.5">
                  <span>{metric.label}</span>
                  <div className="h-[3px] rounded-sm bg-af-surface2">
                    <div className="h-full rounded-sm bg-af-accent" style={{ width: `${metric.percentage}%` }} />
                  </div>
                </div>
                <span className="text-right font-medium">{metric.count}</span>
                <span className="text-right text-af-ink3">{metric.percentage}%</span>
              </div>
            ))
          )}
        </Panel>
      </div>
    </Page>
  );
}
