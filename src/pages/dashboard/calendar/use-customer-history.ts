import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { Appointment } from "@/hooks/use-appointments";
import { supabase } from "@/lib/supabase";

export interface CustomerHistory {
  visits: number;
  totalSpent: number;
  firstVisit: string | null;
  recent: { id: string; serviceName: string; startTime: string; employeeName: string | null; price: number }[];
}

/**
 * Histórico da cliente do agendamento selecionado: visitas, total gasto e últimos atendimentos.
 * Identifica pela customer_id e, na falta dela, pelo telefone informado na reserva.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function useCustomerHistory(appointment: Appointment | null | undefined) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id ?? null;
  const customerId = appointment?.customer_id ?? null;
  const phone = appointment?.customer_phone?.trim() || null;

  return useQuery({
    queryKey: ["customer-history", organizationId, customerId ?? phone],
    enabled: Boolean(organizationId && (customerId || phone)),
    staleTime: 60_000,
    queryFn: async (): Promise<CustomerHistory> => {
      let query = supabase
        .from("appointments")
        .select("id, start_time, status, amount_paid, service:services(name, price), employee:profiles(full_name)")
        .eq("organization_id", organizationId as string)
        .neq("status", "cancelled")
        .order("start_time", { ascending: false })
        .limit(200);
      query = customerId ? query.eq("customer_id", customerId) : query.eq("customer_phone", phone as string);

      const { data, error } = await query;
      if (error) throw error;

      type Row = { id: string; start_time: string; status: string; amount_paid: number | null; service: { name: string; price: number } | { name: string; price: number }[] | null; employee: { full_name: string } | { full_name: string }[] | null };
      const rows = ((data ?? []) as Row[]).map((row) => ({
        ...row,
        service: Array.isArray(row.service) ? row.service[0] ?? null : row.service,
        employee: Array.isArray(row.employee) ? row.employee[0] ?? null : row.employee,
      }));
      const completed = rows.filter((row) => row.status === "completed");

      return {
        visits: completed.length,
        totalSpent: completed.reduce((sum, row) => sum + (row.amount_paid || row.service?.price || 0), 0),
        firstVisit: rows.length > 0 ? rows[rows.length - 1].start_time : null,
        recent: completed
          .filter((row) => row.id !== appointment?.id)
          .slice(0, 3)
          .map((row) => ({
            id: row.id,
            serviceName: row.service?.name ?? "Serviço",
            startTime: row.start_time,
            employeeName: row.employee?.full_name ?? null,
            price: row.amount_paid || row.service?.price || 0,
          })),
      };
    },
  });
}
