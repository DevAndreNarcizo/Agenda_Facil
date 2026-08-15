import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

export type AppointmentStatus =
  "pending" | "confirmed" | "completed" | "cancelled";

export interface Appointment {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_id: string;
  employee_id: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
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
  payment_status: "pending" | "paid" | "refunded";
  payment_method?: "credit_card" | "debit_card" | "pix" | "cash" | "online";
  amount_paid: number;
  is_blocked?: boolean;
  reminder_sent_at?: string;
}

export interface CreateAppointmentInput {
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  serviceId?: string | null;
  employeeId?: string | null;
  startTime: string;
  endTime: string;
  notes?: string | null;
}

type ManageAppointmentCommand =
  | ({ action: "create" } & CreateAppointmentInput)
  | {
      action: "update-status";
      appointmentId: string;
      status: AppointmentStatus;
    }
  | { action: "cancel"; appointmentId: string };

type ManageAppointmentResponse = {
  appointment?: Appointment;
  error?: string;
};

/**
 * Converte uma resposta de erro da Edge Function em mensagem própria para a interface.
 *
 * @author André Narcizo
 */
async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const body = (await context
        .clone()
        .json()
        .catch(() => null)) as ManageAppointmentResponse | null;
      const message = body?.error;
      if (context.status === 409) {
        return (
          message ?? "Conflito de horário. Atualize a agenda e tente novamente."
        );
      }
      if (message) return message;
    }
  }

  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação na agenda.";
}

/**
 * Executa comandos de agenda somente pela fronteira autorizada do servidor.
 *
 * @author André Narcizo
 */
async function manageAppointment(
  command: ManageAppointmentCommand,
): Promise<Appointment> {
  const { data, error } =
    await supabase.functions.invoke<ManageAppointmentResponse>(
      "manage-appointment",
      { body: command },
    );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }
  if (!data?.appointment) {
    throw new Error(
      data?.error ?? "A agenda não retornou o agendamento atualizado.",
    );
  }

  return data.appointment;
}

/**
 * Normaliza dados relacionais opcionais recebidos do PostgREST para o contrato da tela.
 *
 * @author André Narcizo
 */
function normalizeAppointment(item: Record<string, unknown>): Appointment {
  return {
    ...item,
    employee: Array.isArray(item.employee) ? item.employee[0] : item.employee,
    payment_status: (item.payment_status ||
      "pending") as Appointment["payment_status"],
    amount_paid: (item.amount_paid || 0) as number,
    customer_phone: (item.customer_phone || "") as string,
    customer_name: (item.customer_name || "Cliente sem nome") as string,
  } as Appointment;
}

/**
 * Busca agendamentos e encaminha as mudanças críticas para a Edge Function autorizada.
 *
 * @author André Narcizo
 */
export function useAppointments() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ["appointments", profile?.organization_id] as const,
    [profile?.organization_id],
  );

  const {
    data: appointments = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error: queryError } = await supabase
        .from("appointments")
        .select(
          `
          *,
          service:services(name, price, duration_minutes),
          employee:profiles(full_name)
        `,
        )
        .eq("organization_id", profile.organization_id)
        .order("start_time", { ascending: true });

      if (
        queryError?.code === "PGRST200" ||
        queryError?.message?.includes("relationship")
      ) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("appointments")
          .select("*")
          .eq("organization_id", profile.organization_id)
          .order("start_time", { ascending: true });

        if (fallbackError) throw fallbackError;
        return (fallbackData ?? []).map(normalizeAppointment) as Appointment[];
      }
      if (queryError) throw queryError;

      return (data ?? []).map(normalizeAppointment) as Appointment[];
    },
    enabled: Boolean(profile?.organization_id),
  });

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
        () => queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, queryClient, queryKey]);

  const createAppointmentMutation = useMutation({
    mutationFn: (appointment: CreateAppointmentInput) =>
      manageAppointment({
        action: "create",
        ...appointment,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      manageAppointment({ action: "update-status", appointmentId: id, status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const cancelAppointmentMutation = useMutation({
    mutationFn: (id: string) =>
      manageAppointment({ action: "cancel", appointmentId: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    appointments,
    loading,
    error: error instanceof Error ? error.message : null,
    createAppointment: createAppointmentMutation.mutateAsync,
    updateAppointmentStatus: (id: string, status: AppointmentStatus) =>
      updateStatusMutation.mutateAsync({ id, status }),
    cancelAppointment: cancelAppointmentMutation.mutateAsync,
    creating: createAppointmentMutation.isPending,
    updatingStatus: updateStatusMutation.isPending,
    cancelling: cancelAppointmentMutation.isPending,
  };
}
