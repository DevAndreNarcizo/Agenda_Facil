import { useEffect, useState } from "react";
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
}

// Hook customizado para buscar agendamentos
export function useAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchAppointments = async () => {
      try {
        setLoading(true);
        
        // Buscar o perfil do usuário para pegar o organization_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();

        if (!profile) throw new Error("Perfil não encontrado");

        // Buscar agendamentos da organização com informações do serviço
        const { data, error: fetchError } = await supabase
          .from("appointments")
          .select(`
            *,
            service:services(name, price, duration_minutes)
          `)
          .eq("organization_id", profile.organization_id)
          .order("start_time", { ascending: true });

        if (fetchError) throw fetchError;

        setAppointments(data || []);
      } catch (err: any) {
        console.error("Erro ao buscar agendamentos:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();

    // Configurar realtime subscription para atualizações
    const channel = supabase
      .channel("appointments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        () => {
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { appointments, loading, error };
}
