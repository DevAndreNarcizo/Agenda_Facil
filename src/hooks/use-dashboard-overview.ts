import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { Appointment } from "@/hooks/use-appointments";
import { supabase } from "@/lib/supabase";

const SELECT = "id, customer_name, customer_phone, customer_id, service_id, employee_id, start_time, end_time, status, created_at, booking_source, organization_id, payment_status, amount_paid, service:services(name, price, duration_minutes)";

/**
 * Normaliza a relação de serviço (PostgREST pode devolver objeto ou lista).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function normalize(rows: Record<string, unknown>[]): Appointment[] {
  return rows.map((row) => ({
    ...row,
    service: Array.isArray(row.service) ? row.service[0] : row.service,
    customer_name: (row.customer_name as string | null) || "Cliente sem nome",
  })) as unknown as Appointment[];
}

/**
 * Próximas reservas aguardando confirmação (qualquer data futura) e o total pendente.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function usePendingAppointments(limit = 5) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id ?? null;

  const query = useQuery({
    queryKey: ["appointments", organizationId, "pending-upcoming", limit],
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("appointments")
        .select(SELECT, { count: "exact" })
        .eq("organization_id", organizationId as string)
        .eq("status", "pending")
        .gte("end_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return { items: normalize((data ?? []) as Record<string, unknown>[]), total: count ?? 0 };
    },
  });

  return { pending: query.data?.items ?? [], pendingTotal: query.data?.total ?? 0, loading: query.isLoading };
}

/**
 * Últimas reservas criadas (atividade recente), independente da data do atendimento.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function useRecentActivity(limit = 4) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id ?? null;

  const query = useQuery({
    queryKey: ["appointments", organizationId, "recent-activity", limit],
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(SELECT)
        .eq("organization_id", organizationId as string)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return normalize((data ?? []) as Record<string, unknown>[]);
    },
  });

  return { recent: query.data ?? [], loading: query.isLoading };
}
