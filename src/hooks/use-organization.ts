import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getAppointmentUtcRange } from "@/lib/appointment-filters";
import { todayKey } from "@/lib/agenda-time";
import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/lib/database.types";

export type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
export type OrganizationSettingsRow = Database["public"]["Tables"]["organization_settings"]["Row"];

export type PlanCode = "starter" | "pro" | "clinic";

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  monthlyPrice: number;
  subtitle: string;
  /** Limite de profissionais; null = ilimitado. */
  professionalLimit: number | null;
  /** Limite de agendamentos/mês; null = ilimitado. */
  monthlyAppointmentLimit: number | null;
  features: { text: string; included: boolean }[];
}

/**
 * Catálogo de planos exibido no painel; códigos batem com a Edge Function create-checkout.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const PLANS: PlanDefinition[] = [
  {
    code: "starter", name: "Starter", monthlyPrice: 39, subtitle: "1 profissional", professionalLimit: 1, monthlyAppointmentLimit: 100,
    features: [
      { text: "Agenda pública de agendamento", included: true },
      { text: "Lembretes WhatsApp automáticos", included: true },
      { text: "Até 100 agendamentos/mês", included: true },
      { text: "Suporte por WhatsApp", included: true },
      { text: "Múltiplos profissionais", included: false },
      { text: "Relatórios", included: false },
    ],
  },
  {
    code: "pro", name: "Pro", monthlyPrice: 69, subtitle: "Até 5 profissionais", professionalLimit: 5, monthlyAppointmentLimit: null,
    features: [
      { text: "Tudo do Starter", included: true },
      { text: "Agendamentos ilimitados", included: true },
      { text: "Relatório de agendamentos", included: true },
      { text: "Link personalizado + logo", included: true },
      { text: "Confirmação personalizada", included: true },
    ],
  },
  {
    code: "clinic", name: "Clínica", monthlyPrice: 99, subtitle: "Profissionais ilimitados", professionalLimit: null, monthlyAppointmentLimit: null,
    features: [
      { text: "Tudo do Pro", included: true },
      { text: "Painel financeiro básico", included: true },
      { text: "Cadastro de clientes avançado", included: true },
      { text: "Suporte prioritário", included: true },
      { text: "Onboarding presencial (GO)", included: true },
    ],
  },
];

/**
 * Resolve o plano a partir do plan_name persistido, com Starter como fallback seguro.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function getPlan(planName: string | null | undefined): PlanDefinition {
  const normalized = (planName ?? "").toLowerCase();
  return PLANS.find((plan) => plan.code === normalized || plan.name.toLowerCase() === normalized) ?? PLANS[0];
}

export interface SubscriptionSummary {
  plan: PlanDefinition;
  status: string;
  isTrial: boolean;
  trialEnd: Date | null;
  trialDaysLeft: number | null;
  /** Fração (0–1) do período de teste já consumido, para a barra do card lateral. */
  trialProgress: number;
}

const TRIAL_LENGTH_DAYS = 14;

/**
 * Deriva o resumo de assinatura (plano, teste, dias restantes) a partir da organização.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function getSubscriptionSummary(organization: OrganizationRow | null | undefined, now: Date = new Date()): SubscriptionSummary {
  const plan = getPlan(organization?.plan_name);
  const status = organization?.subscription_status ?? "trialing";
  const trialEnd = organization?.trial_end ? new Date(organization.trial_end) : null;
  const isTrial = status === "trialing";
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86_400_000)) : null;
  const trialProgress = trialDaysLeft === null ? 0 : Math.min(1, Math.max(0, 1 - trialDaysLeft / TRIAL_LENGTH_DAYS));
  return { plan, status, isTrial, trialEnd, trialDaysLeft, trialProgress };
}

/**
 * Dados da organização do usuário (nome, slug, plano, cores) e configurações complementares.
 * Cache compartilhado entre sidebar, Assinatura e Configurações.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function useOrganization() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id ?? null;
  const queryClient = useQueryClient();

  const organizationQuery = useQuery({
    queryKey: ["organization", organizationId],
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("*").eq("id", organizationId as string).single();
      if (error) throw error;
      return data as OrganizationRow;
    },
  });

  const settingsQuery = useQuery({
    queryKey: ["organization-settings", organizationId],
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_settings")
        .select("*")
        .eq("organization_id", organizationId as string)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as OrganizationSettingsRow | null;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: {
      organization?: Partial<Pick<OrganizationRow, "name" | "slug" | "logo_url" | "primary_color">>;
      settings?: { specialty?: string; instagram?: string; address?: Json };
    }) => {
      if (!organizationId) throw new Error("Organização não encontrada.");
      if (input.organization) {
        const { error } = await supabase.from("organizations").update(input.organization).eq("id", organizationId);
        if (error) throw error;
      }
      if (input.settings) {
        const { error } = await supabase
          .from("organization_settings")
          .upsert({ organization_id: organizationId, ...input.settings, updated_at: new Date().toISOString() }, { onConflict: "organization_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["organization", organizationId] });
      void queryClient.invalidateQueries({ queryKey: ["organization-settings", organizationId] });
    },
  });

  return {
    organization: organizationQuery.data ?? null,
    settings: settingsQuery.data ?? null,
    loading: organizationQuery.isLoading || settingsQuery.isLoading,
    subscription: getSubscriptionSummary(organizationQuery.data),
    updateOrganization: updateMutation.mutateAsync,
    saving: updateMutation.isPending,
  };
}

/**
 * Contagem leve (HEAD) dos agendamentos ativos de hoje, para o contador da navegação.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function useTodayAppointmentCount() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id ?? null;
  const dateKey = todayKey();

  return useQuery({
    queryKey: ["appointments", organizationId, "today-count", dateKey],
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    queryFn: async () => {
      const range = getAppointmentUtcRange(dateKey, "day");
      const { count, error } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId as string)
        .neq("status", "cancelled")
        .gte("start_time", range.start.toISOString())
        .lt("start_time", range.end.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  }).data ?? 0;
}
