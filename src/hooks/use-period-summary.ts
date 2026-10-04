import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getAppointmentUtcRange, type AppointmentView } from "@/lib/appointment-filters";
import { supabase } from "@/lib/supabase";

export interface PeriodSummary {
  total: number;
  pending: number;
  completed: number;
  bookedMinutes: number;
  paidRevenue: number;
}

const EMPTY: PeriodSummary = { total: 0, pending: 0, completed: 0, bookedMinutes: 0, paidRevenue: 0 };

/**
 * Resumo agregado no servidor (RPC get_period_summary) para o dia/semana/mês da data informada.
 * Substitui contagens feitas no navegador sobre listas paginadas, que paravam em 100 registros.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function usePeriodSummary(dateKey: string, view: AppointmentView) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id ?? null;

  const query = useQuery({
    // Prefixo "appointments" faz o Realtime de agendamentos invalidar o resumo também.
    queryKey: ["appointments", organizationId, "summary", dateKey, view],
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    queryFn: async (): Promise<PeriodSummary> => {
      const range = getAppointmentUtcRange(dateKey, view);
      const { data, error } = await supabase.rpc("get_period_summary", {
        p_start: range.start.toISOString(),
        p_end: range.end.toISOString(),
      });
      if (error) throw error;
      const row = data?.[0];
      if (!row) return EMPTY;
      return {
        total: Number(row.total),
        pending: Number(row.pending),
        completed: Number(row.completed),
        bookedMinutes: Number(row.booked_minutes),
        paidRevenue: Number(row.paid_revenue),
      };
    },
  });

  return { summary: query.data ?? EMPTY, loading: query.isLoading, error: query.error };
}
