import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { normalizeCustomerInput } from "@/lib/customer-normalizers";
import { getSupabaseErrorMessage, isMissingRelationError } from "@/lib/supabase-errors";

export interface Customer {
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

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("name");

      if (error && isMissingRelationError(error)) {
        throw new Error(getSupabaseErrorMessage(error));
      }

      if (error) throw error;

      const customerIds = (data || []).map((c: { id: string }) => c.id);

      if (customerIds.length === 0) return data as Customer[];

      const { data: appointmentStats } = await supabase
        .from("appointments")
        .select("customer_id, start_time, status")
        .in("customer_id", customerIds)
        .neq("status", "cancelled")
        .order("start_time", { ascending: false });

      const statsMap = new Map<string, { last_appointment: string | null; total_appointments: number }>();

      for (const apt of (appointmentStats || [])) {
        const existing = statsMap.get(apt.customer_id);
        if (existing) {
          existing.total_appointments += 1;
        } else {
          statsMap.set(apt.customer_id, {
            last_appointment: apt.start_time,
            total_appointments: 1,
          });
        }
      }

      return (data || []).map((customer: Customer) => ({
        ...customer,
        last_appointment: statsMap.get(customer.id)?.last_appointment || null,
        total_appointments: statsMap.get(customer.id)?.total_appointments || 0,
      })) as Customer[];
    },
    enabled: !!profile?.organization_id,
  });

  const createMutation = useMutation({
    mutationFn: async (customer: { name: string; phone: string; email?: string | null }) => {
      if (!profile?.organization_id) {
        throw new Error("Organização não encontrada. Faça login novamente.");
      }

      const normalizedCustomer = normalizeCustomerInput(customer);

      if (!normalizedCustomer.name) {
        throw new Error("Informe o nome do cliente.");
      }

      if (!normalizedCustomer.phone) {
        throw new Error("Informe o telefone do cliente.");
      }

      const { data, error } = await supabase
        .from("customers")
        .insert({
          ...normalizedCustomer,
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) {
        throw new Error(getSupabaseErrorMessage(error));
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", profile?.organization_id] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { name?: string; phone?: string; email?: string | null } }) => {
      const normalizedUpdates = {
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone.replace(/\D/g, "") } : {}),
        ...(updates.email !== undefined ? { email: updates.email?.trim().toLowerCase() || null } : {}),
      };

      const { data, error } = await supabase
        .from("customers")
        .update(normalizedUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new Error(getSupabaseErrorMessage(error));
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", profile?.organization_id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);

      if (error) {
        throw new Error(getSupabaseErrorMessage(error));
      }
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
    createCustomer: (customer: { name: string; phone: string; email?: string | null }) => createMutation.mutateAsync(customer),
    updateCustomer: (id: string, updates: { name?: string; phone?: string; email?: string | null }) => updateMutation.mutateAsync({ id, updates }),
    deleteCustomer: (id: string) => deleteMutation.mutateAsync(id),
  };
}
