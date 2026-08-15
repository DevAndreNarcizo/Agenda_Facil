import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { WelcomeStep } from "./steps/WelcomeStep";
import { ProfessionalStep } from "./steps/ProfessionalStep";
import { AddressStep } from "./steps/AddressStep";
import { ServiceStep } from "./steps/ServiceStep";
import { HoursStep } from "./steps/HoursStep";
import { SuccessStep } from "./steps/SuccessStep";

export interface OnboardingData {
  // Welcome (business info)
  businessName: string;
  // Professional
  specialty: string;
  instagram: string;
  bio: string;
  // Address
  cep: string;
  address: string;
  city: string;
  state: string;
  number: string;
  // Service
  serviceName: string;
  servicePrice: string;
  serviceDuration: string;
  serviceCategory: string;
  // Hours
  schedule: { label: string; short: string; active: boolean; start: string; end: string }[];
}

const INITIAL_DATA: OnboardingData = {
  businessName: "",
  specialty: "",
  instagram: "",
  bio: "",
  cep: "",
  address: "",
  city: "",
  state: "",
  number: "",
  serviceName: "",
  servicePrice: "",
  serviceDuration: "",
  serviceCategory: "",
  schedule: [
    { label: "Segunda-feira", short: "Seg", active: true, start: "08:00", end: "18:00" },
    { label: "Terça-feira", short: "Ter", active: true, start: "08:00", end: "18:00" },
    { label: "Quarta-feira", short: "Qua", active: true, start: "08:00", end: "18:00" },
    { label: "Quinta-feira", short: "Qui", active: true, start: "08:00", end: "18:00" },
    { label: "Sexta-feira", short: "Sex", active: true, start: "08:00", end: "18:00" },
    { label: "Sábado", short: "Sab", active: false, start: "08:00", end: "13:00" },
    { label: "Domingo", short: "Dom", active: false, start: "08:00", end: "13:00" },
  ],
};

const STEP_LABELS = ["Boas-vindas", "Perfil", "Endereço", "Serviço", "Horários", "Finalizar"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const totalSteps = 6;
  const progress = ((step + 1) / totalSteps) * 100;


  const updateData = (partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  /**
   * Finaliza o onboarding por uma única transação validada no servidor.
   *
   * @author André Narcizo
   */
  const handleFinishOnboarding = async (): Promise<void> => {
    if (!user) {
      toast.error("Usuário não autenticado.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("complete-onboarding", {
        body: {
          ...data,
          schedule: data.schedule.map((item, dayOfWeek) => ({
            active: item.active,
            dayOfWeek,
            end: item.end,
            start: item.start,
          })),
          serviceDuration: Number(data.serviceDuration),
          servicePrice: Number(data.servicePrice),
        },
      });
      if (error) throw error;

      await refreshProfile();
      toast.success("Sua empresa foi criada com sucesso!");
      nextStep();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao criar empresa. Tente novamente.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <WelcomeStep data={data} updateData={updateData} onNext={nextStep} />;
      case 1:
        return <ProfessionalStep data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />;
      case 2:
        return <AddressStep data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />;
      case 3:
        return <ServiceStep data={data} updateData={updateData} onNext={nextStep} onBack={prevStep} />;
      case 4:
        return (
          <HoursStep
            data={data}
            updateData={updateData}
            onNext={handleFinishOnboarding}
            onBack={prevStep}
            saving={saving}
          />
        );
      case 5:
        return <SuccessStep onFinish={() => navigate("/dashboard")} />;
      default:
        return <WelcomeStep data={data} updateData={updateData} onNext={nextStep} />;
    }
  };

  return (
    <div className="min-h-screen bg-stitch-background text-stitch-on-surface flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Blobs */}
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-stitch-primary/5 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-stitch-secondary-container/10 rounded-full blur-[120px] -z-10 animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        {/* Header/Logo */}
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-stitch-primary rounded-xl flex items-center justify-center text-stitch-on-primary shadow-lg shadow-stitch-primary/20">
              <span className="material-symbols-outlined font-black text-2xl">content_cut</span>
            </div>
            <span className="text-3xl font-black tracking-tighter text-stitch-on-surface">AgendaFácil</span>
          </div>

          <div className="w-full max-w-sm space-y-3">
            <div className="flex justify-between items-center">
              <Badge className="bg-stitch-primary/10 text-stitch-primary border-0 px-4 py-1.5 rounded-full font-black uppercase tracking-widest text-xs">
                {STEP_LABELS[step]}
              </Badge>
              <span className="text-xs font-black uppercase tracking-wider text-stitch-on-surface-variant opacity-50">
                {step + 1}/{totalSteps} — {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-1.5 bg-stitch-surface-container" />
          </div>
        </div>

        {/* Step Content */}
        <div className="transition-all duration-500 ease-in-out">
          {renderStep()}
        </div>

        {/* Footer */}
        <p className="text-center text-xs font-bold uppercase tracking-widest text-stitch-on-surface-variant opacity-30">
          Configuração Segura SSL/256
        </p>
      </div>
    </div>
  );
}
