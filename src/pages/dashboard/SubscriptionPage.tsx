import { useState } from "react";
import { toast } from "sonner";
import { useAppointments } from "@/hooks/use-appointments";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useEmployees } from "@/hooks/use-employees";
import { PLANS, useOrganization, type PlanCode } from "@/hooks/use-organization";
import { Icon, KpiCell, KpiStrip, Page, PageHeader, PanelButton, Skeleton, Tag } from "@/components/panel/primitives";
import { formatInstant } from "@/lib/agenda-time";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  trialing: "Teste grátis",
  active: "Ativo",
  past_due: "Pagamento pendente",
  canceled: "Cancelado",
  incomplete: "Incompleto",
};

/**
 * Assinatura: resumo do plano e uso, comparação de planos e checkout via Stripe (create-checkout).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export default function SubscriptionPage() {
  const { organization, subscription, loading } = useOrganization();
  const { employees } = useEmployees();
  const { appointments } = useAppointments();
  const stats = useDashboardStats(appointments);
  const [loadingPlan, setLoadingPlan] = useState<PlanCode | null>(null);
  const current = subscription.plan;
  const currentIndex = PLANS.findIndex((plan) => plan.code === current.code);

  /**
   * Inicia o checkout da Stripe para o plano escolhido e redireciona o navegador.
   *
   * @author André Narcizo - andre.narcizo@sysout.com.br
   */
  const handleSubscribe = async (planCode: PlanCode) => {
    if (!organization) return;
    setLoadingPlan(planCode);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", { body: { planCode } });
      if (error) throw error;
      if (data?.url) window.location.assign(data.url);
      else throw new Error("O checkout não retornou um endereço válido.");
    } catch (cause) {
      toast.error(`Não foi possível iniciar o checkout: ${cause instanceof Error ? cause.message : "erro desconhecido"}`);
    } finally {
      setLoadingPlan(null);
    }
  };

  if (loading) {
    return (
      <Page>
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-[106px]" />
        <Skeleton className="h-[380px]" />
      </Page>
    );
  }

  const limit = current.professionalLimit;
  const usage = limit ? Math.min(1, employees.length / limit) : 0;
  const nextChargeDate = subscription.isTrial && subscription.trialEnd ? subscription.trialEnd : null;

  return (
    <Page>
      <PageHeader
        eyebrow="Plano e faturamento"
        title="Assinatura"
        actions={<span className="flex items-center gap-1.5 text-[13px] text-af-ink2"><Icon name="lock" size={16} />Pagamentos processados com segurança pela Stripe</span>}
      />

      <KpiStrip>
        <KpiCell
          label="Plano atual"
          value={<span className="flex items-center gap-2">{current.name}<Tag>{STATUS_LABELS[subscription.status] ?? subscription.status}</Tag></span>}
          sub={subscription.isTrial && subscription.trialEnd ? `Teste termina em ${formatInstant(subscription.trialEnd, { day: "numeric", month: "long" })}` : "Cobrança mensal"}
        />
        <KpiCell
          label="Próxima cobrança"
          value={formatCurrency(current.monthlyPrice)}
          sub={nextChargeDate ? formatInstant(nextChargeDate, { day: "numeric", month: "short", year: "numeric" }) : "Conforme o ciclo da Stripe"}
        />
        <KpiCell label="Profissionais" value={<>{employees.length} <span className="text-[15px] font-normal text-af-ink3">{limit ? `de ${limit}` : "· ilimitado"}</span></>}>
          {limit && (
            <div className="mt-0.5 h-1 rounded-sm bg-af-surface2">
              <div className={cn("h-full rounded-sm", usage >= 1 ? "bg-af-pend" : "bg-af-accent")} style={{ width: `${Math.round(usage * 100)}%` }} />
            </div>
          )}
        </KpiCell>
        <KpiCell
          label="Agendamentos no mês"
          value={stats.monthAppointments}
          sub={current.monthlyAppointmentLimit ? `Limite de ${current.monthlyAppointmentLimit} no plano ${current.name}` : `Ilimitado no plano ${current.name}`}
        />
      </KpiStrip>

      <h2 className="m-0 text-[15px] font-semibold">Planos</h2>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
        {PLANS.map((plan, index) => {
          const isCurrent = plan.code === current.code;
          const isUpgrade = index > currentIndex;
          return (
            <div key={plan.code} className={cn("flex flex-col gap-[18px] rounded-af-lg border bg-af-surface p-[22px]", isCurrent ? "border-af-accent" : "border-af-line")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold">{plan.name}</span>
                {isCurrent && <Tag>Plano atual</Tag>}
              </div>
              <div className="flex flex-col gap-1">
                <span className="flex items-baseline gap-1">
                  <span className="text-[34px] font-bold leading-none tracking-[-0.02em]">{formatCurrency(plan.monthlyPrice, { compact: true })}</span>
                  <span className="text-[13px] text-af-ink3">/mês</span>
                </span>
                <span className="text-[13px] text-af-ink2">{plan.subtitle}</span>
              </div>
              <div className="h-px bg-af-line" />
              <ul className="m-0 flex flex-1 list-none flex-col gap-2.5 p-0">
                {plan.features.map((feature) => (
                  <li key={feature.text} className={cn("flex items-start gap-2 text-[13px]", feature.included ? "text-af-ink" : "text-af-ink3")}>
                    <Icon name={feature.included ? "check" : "remove"} size={17} className={feature.included ? "text-af-ok" : "text-af-ink3"} />
                    {feature.text}
                  </li>
                ))}
              </ul>
              <PanelButton
                size="md"
                className="h-[38px] w-full"
                variant={isUpgrade ? "primary" : "secondary"}
                disabled={isCurrent || loadingPlan !== null}
                onClick={() => void handleSubscribe(plan.code)}
              >
                {loadingPlan === plan.code ? "Abrindo checkout…" : isCurrent ? "Plano atual" : isUpgrade ? "Fazer upgrade" : `Mudar para ${plan.name}`}
              </PanelButton>
            </div>
          );
        })}
      </div>
    </Page>
  );
}
