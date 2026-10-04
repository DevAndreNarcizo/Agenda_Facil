import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { assertRowsAffected } from "@/hooks/use-organization";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  organization_id: string;
  created_at: string;
  last_appointment?: string | null;
  total_appointments?: number;
}

export function useCustomers() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading: loading, error } = useQuery({
    queryKey: ["customers", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Buscar clientes com dados do último agendamento
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("name");

      // Se a tabela não existir (404), retornar vazio
      if (error?.code === "PGRST116" || error?.code === "42P01" || error?.message?.includes("not found")) {
        return [];
      }
      if (error) throw error;

      // Última visita e total vêm agregados do banco (RPC get_customer_stats), em vez de
      // `.in(customer_id, [todos os ids])`, que estourava o limite de URL com muitos clientes.
      const { data: appointmentStats, error: statsError } = await supabase.rpc("get_customer_stats");
      if (statsError) throw statsError;

      const statsMap = new Map<string, { last_appointment: string | null; total_appointments: number }>(
        (appointmentStats ?? []).map((row) => [
          row.customer_id,
          { last_appointment: row.last_appointment, total_appointments: Number(row.total_appointments) },
        ]),
      );

      return (data || []).map((customer) => ({
        ...customer,
        phone: customer.phone ?? '',
        last_appointment: statsMap.get(customer.id)?.last_appointment || null,
        total_appointments: statsMap.get(customer.id)?.total_appointments || 0,
      })) as Customer[];
    },
    enabled: !!profile?.organization_id,
  });

  const createMutation = useMutation({
    mutationFn: async (customer: { name: string; phone: string; email?: string }) => {
      const organizationId = profile?.organization_id;
      if (!organizationId) {
        throw new Error('Organização não encontrada');
      }

      const { data, error } = await supabase
        .from("customers")
        .insert({
          ...customer,
          organization_id: organizationId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", profile?.organization_id] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { name?: string; phone?: string; email?: string } }) => {
      const organizationId = profile?.organization_id;
      if (!organizationId) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", id)
        .eq('organization_id', organizationId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", profile?.organization_id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const organizationId = profile?.organization_id;
      if (!organizationId) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id)
        .eq('organization_id', organizationId)
        .select("id");
      if (error) throw error;
      assertRowsAffected(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", profile?.organization_id] });
    },
  });

  // Estatísticas calculadas
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const newThisMonth = customers.filter(c => c.created_at >= startOfMonth).length;
  const withAppointments = customers.filter(c => (c.total_appointments || 0) > 1).length;
  const returnRate = customers.length > 0 ? Math.round((withAppointments / customers.length) * 100) : 0;

  return {
    customers,
    loading,
    error: error ? (error as Error).message : null,
    newThisMonth,
    returnRate,
    totalCustomers: customers.length,
    createCustomer: (customer: { name: string; phone: string; email?: string }) => createMutation.mutateAsync(customer),
    updateCustomer: (id: string, updates: { name?: string; phone?: string; email?: string }) => updateMutation.mutateAsync({ id, updates }),
    deleteCustomer: (id: string) => deleteMutation.mutateAsync(id),
  };
}
