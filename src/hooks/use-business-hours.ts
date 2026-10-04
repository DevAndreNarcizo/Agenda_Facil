import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { formatMinutes, timeToMinutes } from "@/lib/agenda-time";
import { supabase } from "@/lib/supabase";

export interface BusinessDay {
  /** 0 = domingo … 6 = sábado (mesma convenção da tabela). */
  dayOfWeek: number;
  isActive: boolean;
  /** Minutos desde a meia-noite. */
  start: number;
  end: number;
}

/** Horário padrão quando a organização ainda não definiu o expediente. */
export const DEFAULT_BUSINESS_HOURS: BusinessDay[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  isActive: dayOfWeek !== 0,
  start: 8 * 60,
  end: dayOfWeek === 6 ? 13 * 60 : 18 * 60,
}));

/**
 * Janela de horas visível na grade da agenda: do menor início ao maior término dos dias ativos.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function getAgendaWindow(days: BusinessDay[]): { start: number; end: number } {
  const active = days.filter((day) => day.isActive);
  if (active.length === 0) return { start: 8 * 60, end: 19 * 60 };
  const start = Math.floor(Math.min(...active.map((day) => day.start)) / 60) * 60;
  const end = Math.ceil(Math.max(...active.map((day) => day.end)) / 60) * 60;
  return { start, end: Math.max(end, start + 60) };
}

/**
 * Horário de funcionamento da organização (organization_business_hours) com gravação em lote.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function useBusinessHours() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id ?? null;
  const queryClient = useQueryClient();
  const queryKey = ["business-hours", organizationId] as const;

  const query = useQuery({
    queryKey,
    enabled: Boolean(organizationId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_business_hours")
        .select("day_of_week, is_active, start_time, end_time")
        .eq("organization_id", organizationId as string);
      if (error) throw error;
      if (!data || data.length === 0) return DEFAULT_BUSINESS_HOURS;
      return DEFAULT_BUSINESS_HOURS.map((fallback) => {
        const row = data.find((item) => item.day_of_week === fallback.dayOfWeek);
        return row
          ? { dayOfWeek: row.day_of_week, isActive: row.is_active, start: timeToMinutes(row.start_time), end: timeToMinutes(row.end_time) }
          : { ...fallback, isActive: false };
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (days: BusinessDay[]) => {
      if (!organizationId) throw new Error("Organização não encontrada.");
      const invalid = days.find((day) => day.end <= day.start);
      if (invalid) throw new Error("O término precisa ser depois do início em todos os dias.");
      const { error } = await supabase.from("organization_business_hours").upsert(
        days.map((day) => ({
          organization_id: organizationId,
          day_of_week: day.dayOfWeek,
          is_active: day.isActive,
          start_time: formatMinutes(day.start),
          end_time: formatMinutes(day.end),
        })),
        { onConflict: "organization_id,day_of_week" },
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    days: query.data ?? DEFAULT_BUSINESS_HOURS,
    loading: query.isLoading,
    saveBusinessHours: saveMutation.mutateAsync,
    saving: saveMutation.isPending,
  };
}
