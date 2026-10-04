import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  getAppointmentUtcRange,
  normalizeAppointmentFilters,
  type AppointmentFilters,
} from "@/lib/appointment-filters";
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
  employee?: {
    full_name: string;
  };
  payment_status: "pending" | "paid" | "refunded";
  amount_paid: number;
  is_blocked?: boolean;
  /** Canal de origem da reserva (link público, QR, painel…). */
  booking_source?: string | null;
  /** Instante em que o lembrete automático foi enviado. */
  reminder_sent_at?: string | null;
}

export interface AppointmentBlock {
  id: string;
  employee_id: string | null;
  end_time: string;
  organization_id: string;
  reason: string | null;
  start_time: string;
}

export interface CreateAppointmentInput {
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  employeeId?: string | null;
  notes?: string | null;
  serviceId: string;
  startTime: string;
}

export interface RescheduleAppointmentInput {
  appointmentId: string;
  employeeId?: string | null;
  serviceId: string;
  startTime: string;
}

export interface CreateAppointmentBlockInput {
  employeeId?: string | null;
  endTime: string;
  reason?: string | null;
  startTime: string;
}

interface AppointmentCommandResponse {
  appointment?: Appointment;
  block?: AppointmentBlock;
  deletedBlockId?: string;
  error?: string;
}

type AppointmentCommand =
  | ({ action: "create" } & CreateAppointmentInput)
  | ({ action: "reschedule" } & RescheduleAppointmentInput)
  | {
      action: "update-status";
      appointmentId: string;
      status: AppointmentStatus;
    }
  | { action: "cancel"; appointmentId: string }
  | ({ action: "create-block" } & CreateAppointmentBlockInput)
  | { action: "delete-block"; blockId: string };

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
        .catch(() => null)) as AppointmentCommandResponse | null;
      if (body?.error) return body.error;
      if (context.status === 409)
        return "Conflito de horário. Atualize a agenda e tente novamente.";
    }
  }

  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação na agenda.";
}

/**
 * Executa comandos de agenda exclusivamente pela fronteira autorizada do servidor.
 *
 * @author André Narcizo
 */
async function manageAppointment(
  command: AppointmentCommand,
): Promise<AppointmentCommandResponse> {
  const { data, error } =
    await supabase.functions.invoke<AppointmentCommandResponse>(
      "manage-appointment",
      { body: command },
    );

  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (!data) throw new Error("A agenda não retornou uma resposta válida.");
  if (data.error) throw new Error(data.error);

  return data;
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

/** Tamanho do lote ao carregar um período completo (limite padrão do PostgREST). */
const FETCH_ALL_CHUNK = 1000;

export interface UseAppointmentsOptions {
  /** Ignora page/pageSize e carrega todo o período em lotes (grade da agenda). */
  fetchAll?: boolean;
}

/**
 * Fornece consultas paginadas da agenda e comandos centralizados na Edge Function.
 *
 * @author André Narcizo
 */
export function useAppointments(filters?: AppointmentFilters, options: UseAppointmentsOptions = {}) {
  const fetchAll = Boolean(options.fetchAll);
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const defaultFilters = useMemo(
    () =>
      normalizeAppointmentFilters(
        new URLSearchParams("view=month&pageSize=100"),
      ),
    [],
  );
  const activeFilters = filters ?? defaultFilters;
  const range = useMemo(
    () => getAppointmentUtcRange(activeFilters.date, activeFilters.view),
    [activeFilters.date, activeFilters.view],
  );
  const queryKey = useMemo(
    () =>
      [
        "appointments",
        profile?.organization_id,
        activeFilters.date,
        activeFilters.view,
        activeFilters.employeeId ?? "",
        activeFilters.statuses.join(","),
        fetchAll ? "all" : activeFilters.page,
        fetchAll ? "all" : activeFilters.pageSize,
      ] as const,
    [activeFilters, fetchAll, profile?.organization_id],
  );
  const blocksQueryKey = useMemo(
    () => ["appointment-blocks", ...queryKey.slice(1)] as const,
    [queryKey],
  );

  const appointmentsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!profile?.organization_id) return { appointments: [], total: 0 };

      /**
       * Monta a consulta do período para um intervalo de linhas [from, to].
       *
       * @author André Narcizo - andre.narcizo@sysout.com.br
       */
      const buildQuery = (from: number, to: number) => {
        let query = supabase
          .from("appointments")
          .select(
            "*, service:services(name, price, duration_minutes), employee:profiles(full_name)",
            { count: "exact" },
          )
          .eq("organization_id", profile.organization_id as string)
          .gte("start_time", range.start.toISOString())
          .lt("start_time", range.end.toISOString())
          .order("start_time", { ascending: true })
          // Desempate estável: sem ele, lotes paginados podem repetir/omitir empates de horário.
          .order("id", { ascending: true })
          .range(from, to);

        if (activeFilters.employeeId)
          query = query.eq("employee_id", activeFilters.employeeId);
        if (activeFilters.statuses.length > 0)
          query = query.in("status", activeFilters.statuses);
        return query;
      };

      if (fetchAll) {
        const rows: Record<string, unknown>[] = [];
        for (let from = 0; ; from += FETCH_ALL_CHUNK) {
          const { data, error, count } = await buildQuery(from, from + FETCH_ALL_CHUNK - 1);
          if (error) throw error;
          rows.push(...((data ?? []) as Record<string, unknown>[]));
          if (!data || data.length < FETCH_ALL_CHUNK || rows.length >= (count ?? 0)) {
            return { appointments: rows.map(normalizeAppointment), total: count ?? rows.length };
          }
        }
      }

      const { data, error, count } = await buildQuery(
        (activeFilters.page - 1) * activeFilters.pageSize,
        activeFilters.page * activeFilters.pageSize - 1,
      );
      if (error) throw error;
      return {
        appointments: (data ?? []).map(normalizeAppointment) as Appointment[],
        total: count ?? 0,
      };
    },
    enabled: Boolean(profile?.organization_id),
  });

  const blocksQuery = useQuery({
    queryKey: blocksQueryKey,
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from("appointment_blocks")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .gte("start_time", range.start.toISOString())
        .lt("start_time", range.end.toISOString())
        .order("start_time", { ascending: true });

      if (activeFilters.employeeId) {
        query = query.or(
          `employee_id.is.null,employee_id.eq.${activeFilters.employeeId}`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AppointmentBlock[];
    },
    enabled: Boolean(profile?.organization_id),
  });

  useEffect(() => {
    if (!profile?.organization_id) return;

    const channel = supabase
      .channel(`appointments-changes-${profile.organization_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        () =>
          queryClient.invalidateQueries({
            queryKey: ["appointments", profile.organization_id],
          }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointment_blocks",
          filter: `organization_id=eq.${profile.organization_id}`,
        },
        () =>
          queryClient.invalidateQueries({
            queryKey: ["appointment-blocks", profile.organization_id],
          }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.organization_id, queryClient]);

  const createAppointmentMutation = useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      const result = await manageAppointment({ action: "create", ...input });
      if (!result.appointment)
        throw new Error("A agenda não retornou o agendamento criado.");
      return result.appointment;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["appointments", profile?.organization_id],
      }),
  });

  const rescheduleAppointmentMutation = useMutation({
    mutationFn: async (input: RescheduleAppointmentInput) => {
      const result = await manageAppointment({
        action: "reschedule",
        ...input,
      });
      if (!result.appointment)
        throw new Error("A agenda não retornou o agendamento reagendado.");
      return result.appointment;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["appointments", profile?.organization_id],
      }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: AppointmentStatus;
    }) => {
      const result = await manageAppointment({
        action: "update-status",
        appointmentId: id,
        status,
      });
      if (!result.appointment)
        throw new Error("A agenda não retornou o agendamento atualizado.");
      return result.appointment;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["appointments", profile?.organization_id],
      }),
  });

  const cancelAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await manageAppointment({
        action: "cancel",
        appointmentId: id,
      });
      if (!result.appointment)
        throw new Error("A agenda não retornou o agendamento cancelado.");
      return result.appointment;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["appointments", profile?.organization_id],
      }),
  });

  const createBlockMutation = useMutation({
    mutationFn: async (input: CreateAppointmentBlockInput) => {
      const result = await manageAppointment({
        action: "create-block",
        ...input,
      });
      if (!result.block)
        throw new Error("A agenda não retornou o bloqueio criado.");
      return result.block;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["appointment-blocks", profile?.organization_id],
      }),
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const result = await manageAppointment({
        action: "delete-block",
        blockId,
      });
      if (!result.deletedBlockId)
        throw new Error("A agenda não retornou o bloqueio removido.");
      return result.deletedBlockId;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["appointment-blocks", profile?.organization_id],
      }),
  });

  return {
    appointments: appointmentsQuery.data?.appointments ?? [],
    blocks: blocksQuery.data ?? [],
    totalAppointments: appointmentsQuery.data?.total ?? 0,
    loading: appointmentsQuery.isLoading || blocksQuery.isLoading,
    error:
      appointmentsQuery.error instanceof Error
        ? appointmentsQuery.error.message
        : blocksQuery.error instanceof Error
          ? blocksQuery.error.message
          : null,
    createAppointment: createAppointmentMutation.mutateAsync,
    rescheduleAppointment: rescheduleAppointmentMutation.mutateAsync,
    updateAppointmentStatus: (id: string, status: AppointmentStatus) =>
      updateStatusMutation.mutateAsync({ id, status }),
    cancelAppointment: cancelAppointmentMutation.mutateAsync,
    createAppointmentBlock: createBlockMutation.mutateAsync,
    deleteAppointmentBlock: deleteBlockMutation.mutateAsync,
    creating: createAppointmentMutation.isPending,
    rescheduling: rescheduleAppointmentMutation.isPending,
    updatingStatus: updateStatusMutation.isPending,
    cancelling: cancelAppointmentMutation.isPending,
    changingBlock:
      createBlockMutation.isPending || deleteBlockMutation.isPending,
  };
}
