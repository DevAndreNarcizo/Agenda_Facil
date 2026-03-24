import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingData } from "../OnboardingPage";

interface ProfessionalStepProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ProfessionalStep({ data, updateData, onNext, onBack }: ProfessionalStepProps) {
  return (
    <div className="bg-stitch-surface-container-low/30 backdrop-blur-md rounded-[3rem] p-8 md:p-12 shadow-2xl border border-white/5 relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-stitch-primary/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />

      <div className="relative z-10 mb-10">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary shadow-inner">
            <span className="material-symbols-outlined text-2xl">person</span>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-stitch-on-surface tracking-tight font-headline">Perfil Profissional</h2>
            <p className="text-sm text-stitch-on-surface-variant font-bold opacity-60">Conte um pouco mais sobre quem você é.</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <div className="space-y-3">
          <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Especialidade Principal</Label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stitch-on-surface-variant opacity-30 text-xl">content_cut</span>
            <Input
              className="w-full h-14 pl-12 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all"
              placeholder="Ex: Barbeiro, Esteticista..."
              value={data.specialty}
              onChange={(e) => updateData({ specialty: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Instagram Profissional</Label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stitch-on-surface-variant opacity-30 text-xl">photo_camera</span>
            <Input
              className="w-full h-14 pl-12 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all"
              placeholder="@seu_perfil"
              value={data.instagram}
              onChange={(e) => updateData({ instagram: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3 md:col-span-2">
          <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Biografia Curta</Label>
          <textarea
            className="w-full min-h-[120px] p-5 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 shadow-inner outline-none focus:ring-2 focus:ring-stitch-primary/50 transition-all resize-none"
            placeholder="Conte um pouco sobre sua experiência e diferenciais..."
            value={data.bio}
            onChange={(e) => updateData({ bio: e.target.value })}
          />
        </div>
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/5">
        <Button variant="ghost" onClick={onBack} className="h-14 flex-1 rounded-2xl font-bold text-stitch-on-surface-variant opacity-60 hover:opacity-100 hover:bg-white/5">
          <span className="material-symbols-outlined text-lg mr-2">arrow_back</span>
          Voltar
        </Button>
        <Button onClick={onNext} className="h-14 flex-[2] rounded-2xl font-black shadow-xl shadow-stitch-primary/30 bg-stitch-primary text-white hover:scale-[1.02] active:scale-[0.98] transition-all">
          Continuar
          <span className="material-symbols-outlined text-lg ml-2">arrow_forward</span>
        </Button>
      </div>
    </div>
  );
}
