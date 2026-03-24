import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingData } from "../OnboardingPage";

interface WelcomeStepProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
}

export function WelcomeStep({ data, updateData, onNext }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center space-y-10 py-16 px-8 bg-stitch-surface-container-low/30 backdrop-blur-md rounded-[3rem] shadow-2xl border border-white/5 relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-stitch-primary/5 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none" />

      <div className="relative z-10 w-24 h-24 rounded-[2rem] bg-stitch-primary/10 flex items-center justify-center text-stitch-primary shadow-inner">
        <span className="material-symbols-outlined text-6xl">waving_hand</span>
      </div>

      <div className="relative z-10 space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-stitch-on-surface tracking-tight font-headline">Bem-vindo ao AgendaFácil!</h1>
        <p className="text-lg text-stitch-on-surface-variant font-medium max-w-lg mx-auto leading-relaxed opacity-60">
          Vamos configurar o seu negócio em apenas 3 minutos. Comece informando o nome da sua empresa.
        </p>
      </div>

      <div className="relative z-10 w-full max-w-md space-y-3">
        <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Nome do seu negócio</Label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stitch-on-surface-variant opacity-30 text-xl">storefront</span>
          <Input
            className="w-full h-16 pl-12 rounded-2xl border-none bg-[#1a1c1e] text-white font-black text-lg placeholder:text-white/20 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all text-center"
            placeholder="Ex: Studio Alessa, Barbearia do João..."
            value={data.businessName}
            onChange={(e) => updateData({ businessName: e.target.value })}
          />
        </div>
      </div>

      <Button
        onClick={onNext}
        disabled={!data.businessName.trim()}
        className="relative z-10 h-16 px-12 rounded-2xl text-lg font-black gap-3 shadow-xl shadow-stitch-primary/30 hover:scale-[1.03] active:scale-[0.97] transition-all bg-stitch-primary text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        Começar Configuração
        <span className="material-symbols-outlined text-xl">arrow_forward</span>
      </Button>

      <p className="relative z-10 text-sm font-bold text-stitch-on-surface-variant opacity-40 uppercase tracking-widest pt-2">
        Preparado para transformar sua rotina?
      </p>
    </div>
  );
}
