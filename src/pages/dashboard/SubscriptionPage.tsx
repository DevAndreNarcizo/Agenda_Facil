import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, X, Star, Leaf, Building2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const PLANS = [
  {
    id: "price_starter_placeholder", // Replace with real Stripe Price IDs
    name: "Starter",
    price: "R$39",
    subtitle: "/mês · 1 profissional",
    features: [
      { text: "Agenda pública de agendamento", included: true },
      { text: "Lembretes WhatsApp automáticos", included: true },
      { text: "Até 1 profissional", included: true },
      { text: "Até 100 agendamentos/mês", included: true },
      { text: "Suporte por WhatsApp", included: true },
      { text: "Múltiplos profissionais", included: false },
      { text: "Relatórios", included: false },
    ],
    icon: <Leaf className="w-6 h-6 text-[#86efac]" />,
    buttonText: "Selecionar Starter",
  },
  {
    id: "price_pro_placeholder", // Replace with real Stripe Price IDs
    name: "Pro",
    price: "R$69",
    subtitle: "/mês · até 5 profissionais",
    features: [
      { text: "Tudo do Starter", included: true },
      { text: "Até 5 profissionais", included: true },
      { text: "Agendamentos ilimitados", included: true },
      { text: "Relatório de agendamentos", included: true },
      { text: "Link personalizado + logo", included: true },
      { text: "Confirmação personalizada", included: true },
    ],
    icon: <Star className="w-6 h-6 text-[#facc15] fill-[#facc15]" />,
    popular: true,
    buttonText: "Selecionar Pro",
  },
  {
    id: "price_clinica_placeholder", // Replace with real Stripe Price IDs
    name: "Clínica",
    price: "R$99",
    subtitle: "/mês · profissionais ilimitados",
    features: [
      { text: "Tudo do Pro", included: true },
      { text: "Profissionais ilimitados", included: true },
      { text: "Painel financeiro básico", included: true },
      { text: "Cadastro de clientes avançado", included: true },
      { text: "Suporte prioritário", included: true },
      { text: "Onboarding presencial (GO)", included: true },
    ],
    icon: <Building2 className="w-6 h-6 text-[#94a3b8]" />,
    buttonText: "Selecionar Clínica",
  },
];

export default function SubscriptionPage() {
  const { profile, user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (planId: string, planName: string) => {
    if (!profile?.organization_id || !user?.email) {
      toast.error("Você precisa estar logado para assinar um plano.");
      return;
    }

    // Verificar se os Price IDs foram configurados
    if (planId.includes("placeholder")) {
      toast.error("Os planos ainda estão sendo configurados. Tente novamente em breve.");
      return;
    }

    setLoadingPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId: planId,
          customerEmail: user.email,
          metadata: {
            organization_id: profile.organization_id,
            planName: planName
          }
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Stripe error:", error);
      toast.error(`Erro ao iniciar checkout: ${error.message || "Erro desconhecido"}`);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="dashboard-flat space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-20 max-w-7xl mx-auto p-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-4">
        <div className="space-y-2">
          <Badge className="bg-stitch-primary/10 text-stitch-primary border-0 px-4 py-1 rounded-full font-black uppercase tracking-widest text-[10px]">Planos e Assinatura</Badge>
          <h1 className="text-4xl font-black text-stitch-on-surface tracking-tight font-headline">Turbine seu Negócio</h1>
          <p className="text-stitch-on-surface-variant font-medium text-lg">Escolha o plano ideal para a sua jornada profissional com 14 dias gratuitos.</p>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
        {PLANS.map((plan) => (
          <Card 
            key={plan.name}
            data-popular={plan.popular ? "true" : "false"}
            className={cn(
              "subscription-plan-card relative rounded-[2rem] border-none shadow-none hover:shadow-none transition-all duration-500 hover:scale-[1.02] bg-stitch-surface-container-low/30 flex flex-col backdrop-blur-xl",
              plan.popular && "scale-[1.05] z-10"
            )}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                <Badge className="bg-stitch-primary text-white border-0 px-6 py-1.5 rounded-xl font-black uppercase tracking-widest text-[10px] whitespace-nowrap shadow-none">
                  MAIS POPULAR
                </Badge>
              </div>
            )}
            
            <CardHeader className="p-10 text-center space-y-4 pt-12">
              <div className="flex justify-center mb-2">
                <div className="p-3 bg-stitch-surface-container-lowest/10 rounded-2xl">
                  {plan.icon}
                </div>
              </div>
              <CardTitle className="text-2xl font-bold font-headline text-stitch-on-surface flex items-center justify-center gap-2">
                {plan.name}
              </CardTitle>
              <div className="space-y-1">
                <div className="text-5xl font-black text-stitch-primary tracking-tighter">
                  {plan.price}
                </div>
                <div className="text-sm font-medium text-stitch-on-surface-variant">
                  {plan.subtitle}
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-8 pb-10 space-y-8 flex-1 flex flex-col justify-between">
              <ul className="space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature.text} className={cn(
                    "flex items-start gap-3 transition-colors",
                    feature.included ? "text-stitch-on-surface" : "text-stitch-on-surface-variant opacity-50"
                  )}>
                    <div className="mt-1 flex-shrink-0">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                      ) : (
                        <X className="w-4 h-4 text-stitch-on-surface-variant stroke-[3]" />
                      )}
                    </div>
                    <span className="text-sm font-medium leading-tight">{feature.text}</span>
                  </li>
                ))}
              </ul>

              <Button 
                onClick={() => handleSubscribe(plan.id, plan.name)}
                disabled={loadingPlan !== null}
                className={cn(
                  "w-full h-14 rounded-2xl text-[10px] tracking-widest uppercase font-black transition-all mt-8",
                  plan.popular 
                    ? "bg-stitch-primary text-white hover:bg-stitch-primary/90 shadow-none" 
                    : "bg-stitch-surface-container-lowest/10 text-stitch-on-surface hover:bg-stitch-surface-container-lowest/20 border-none"
                )}
              >
                {loadingPlan === plan.id ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Aguarde...
                  </span>
                ) : plan.buttonText}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trust Quote */}
      <div className="max-w-3xl mx-auto text-center space-y-4 px-4">
        <p className="text-stitch-on-surface-variant italic font-medium">"O Agenda Fácil transformou a forma como gerencio meus horários. O plano Pro se pagou na primeira semana."</p>
        <div className="flex items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#facc15]/20 flex items-center justify-center">
            <Star className="w-4 h-4 text-[#facc15] fill-[#facc15]" />
          </div>
          <span className="text-sm font-black text-stitch-on-surface">Mariana Luz, Estética Master</span>
        </div>
      </div>
    </div>
  );
}
