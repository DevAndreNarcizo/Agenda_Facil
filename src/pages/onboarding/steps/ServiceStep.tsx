import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingData } from "../OnboardingPage";

interface ServiceStepProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ServiceStep({ data, updateData, onNext, onBack }: ServiceStepProps) {
  return (
    <div className="bg-stitch-surface-container-low/30 backdrop-blur-md rounded-[3rem] p-8 md:p-12 shadow-2xl border border-white/5 relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-stitch-tertiary/5 rounded-full blur-[100px] -ml-32 -mt-32 pointer-events-none" />

      <div className="relative z-10 mb-10">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-stitch-tertiary/10 flex items-center justify-center text-stitch-tertiary shadow-inner">
            <span className="material-symbols-outlined text-2xl">content_cut</span>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-stitch-on-surface tracking-tight font-headline">Primeiro Serviço</h2>
            <p className="text-sm text-stitch-on-surface-variant font-bold opacity-60">Cadastre seu serviço mais popular para começar.</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <div className="space-y-3">
          <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Nome do Serviço</Label>
          <Input
            className="w-full h-14 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all px-5"
            placeholder="Ex: Corte de Cabelo Masculino"
            value={data.serviceName}
            onChange={(e) => updateData({ serviceName: e.target.value })}
          />
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Preço (R$)</Label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stitch-on-surface-variant opacity-30 text-xl">payments</span>
            <Input
              className="w-full h-14 pl-12 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all"
              placeholder="0,00"
              type="number"
              value={data.servicePrice}
              onChange={(e) => updateData({ servicePrice: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Duração (Minutos)</Label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stitch-on-surface-variant opacity-30 text-xl">schedule</span>
            <Input
              className="w-full h-14 pl-12 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all"
              placeholder="30"
              type="number"
              value={data.serviceDuration}
              onChange={(e) => updateData({ serviceDuration: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Categoria</Label>
          <Input
            className="w-full h-14 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all px-5"
            placeholder="Cortes, Estética, Nails..."
            value={data.serviceCategory}
            onChange={(e) => updateData({ serviceCategory: e.target.value })}
          />
        </div>
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/5">
        <Button variant="ghost" onClick={onBack} className="h-14 flex-1 rounded-2xl font-bold text-stitch-on-surface-variant opacity-60 hover:opacity-100 hover:bg-white/5">
          <span className="material-symbols-outlined text-lg mr-2">arrow_back</span>
          Voltar
        </Button>
        <Button onClick={onNext} className="h-14 flex-[2] rounded-2xl font-black shadow-xl shadow-stitch-primary/30 bg-stitch-primary text-white hover:scale-[1.02] active:scale-[0.98] transition-all">
          Cadastrar Serviço
          <span className="material-symbols-outlined text-lg ml-2">arrow_forward</span>
        </Button>
      </div>
    </div>
  );
}
