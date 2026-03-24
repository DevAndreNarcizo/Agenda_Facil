import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

// Interface para um agendamento
export interface Appointment {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  notes?: string;
  created_at: string;
  organization_id: string;
  customer_id?: string;
  service?: {
    name: string;
    price: number;
    duration_minutes: number;
  };
  review?: {
    id: string;
    rating: number;
    comment?: string;
  };
  employee?: {
    full_name: string;
  };
  payment_status: 'pending' | 'paid' | 'refunded';
  payment_method?: 'credit_card' | 'debit_card' | 'pix' | 'cash' | 'online';
  amount_paid: number;
  is_blocked?: boolean;
  reminder_sent_at?: string;
}

// Hook customizado para buscar agendamentos
export function useAppointments() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading: loading, error } = useQuery({
    queryKey: ["appointments", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      // Query básica primeiro, relações adicionadas se as tabelas existirem
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          service:services(name, price, duration_minutes),
          employee:profiles(full_name)
        `)
        .eq("organization_id", profile.organization_id)
        .order("start_time", { ascending: true });

      // Se der erro 400 (relação inválida), tentar query simples
      if (error?.code === "PGRST200" || error?.message?.includes("relationship")) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("appointments")
          .select("*")
          .eq("organization_id", profile.organization_id)
          .order("start_time", { ascending: true });

        if (fallbackError) throw fallbackError;
        return (fallbackData || []).map((item: Record<string, unknown>) => ({
          ...item,
          payment_status: (item.payment_status || 'pending') as Appointment['payment_status'],
          amount_paid: (item.amount_paid || 0) as number,
          customer_phone: (item.customer_phone || "") as string,
          customer_name: (item.customer_name || "Cliente sem nome") as string,
        })) as Appointment[];
      }

      if (error) throw error;

      return (data || []).map((item: Record<string, unknown>) => ({
        ...item,
        employee: Array.isArray(item.employee) ? item.employee[0] : item.employee,
        payment_status: (item.payment_status || 'pending') as Appointment['payment_status'],
        amount_paid: (item.amount_paid || 0) as number,
        customer_phone: (item.customer_phone || "") as string,
        customer_name: (item.customer_name || "Cliente sem nome") as string,
      })) as Appointment[];
    },
    enabled: !!profile?.organization_id,
  });

  // Configurar realtime subscription para atualizações
  useEffect(() => {
    if (!profile?.organization_id) return;

    const channel = supabase
      .channel("appointments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["appointments", profile.organization_id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Appointment["status"] }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", profile?.organization_id] });
    },
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Appointment> }) => {
      const { error } = await supabase
        .from("appointments")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", profile?.organization_id] });
    },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (appointment: {
      customer_id?: string | null;
      customer_name: string;
      customer_phone?: string;
      service_id?: string | null;
      employee_id?: string;
      start_time: string;
      end_time: string;
      status?: Appointment["status"];
      notes?: string;
      is_blocked?: boolean;
    }) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const { data, error } = await supabase
        .from("appointments")
        .insert({
          ...appointment,
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", profile?.organization_id] });
    },
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", profile?.organization_id] });
    },
  });

  return {
    appointments,
    loading,
    error: error ? (error as Error).message : null,
    updateAppointmentStatus: async (id: string, status: Appointment["status"]) => {
      await updateStatusMutation.mutateAsync({ id, status });
    },
    updateAppointment: async (id: string, updates: Partial<Appointment>) => {
      await updateAppointmentMutation.mutateAsync({ id, updates });
    },
    createAppointment: createAppointmentMutation.mutateAsync,
    deleteAppointment: async (id: string) => {
      await deleteAppointmentMutation.mutateAsync(id);
    },
  };
}
