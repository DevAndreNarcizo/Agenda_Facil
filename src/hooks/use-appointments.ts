import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// Interface para um agendamento
export interface Appointment {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_id: string;
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
}

// Hook customizado para buscar agendamentos
export function useAppointments() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading: loading, error } = useQuery({
    queryKey: ["appointments", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          service:services(name, price, duration_minutes),
          review:reviews(id, rating, comment),
          employee:profiles(full_name),
          customer:customers(name, phone)
        `)
        .eq("organization_id", profile.organization_id)
        .order("start_time", { ascending: true });

      if (error) throw error;
      
      return data.map((item: any) => {
        const customer = Array.isArray(item.customer) ? item.customer[0] : item.customer;
        return {
          ...item,
          review: Array.isArray(item.review) ? item.review[0] : item.review,
          employee: Array.isArray(item.employee) ? item.employee[0] : item.employee,
          payment_status: item.payment_status || 'pending',
          amount_paid: item.amount_paid || 0,
          customer_phone: item.customer_phone || customer?.phone || "",
          customer_name: item.customer_name || customer?.name || "Cliente sem nome"
        };
      }) as Appointment[];
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

  return { 
    appointments, 
    loading, 
    error: error ? (error as Error).message : null, 
    updateAppointmentStatus: async (id: string, status: Appointment["status"]) => {
      await updateStatusMutation.mutateAsync({ id, status });
    },
    updateAppointment: async (id: string, updates: Partial<Appointment>) => {
      await updateAppointmentMutation.mutateAsync({ id, updates });
    }
  };
}
