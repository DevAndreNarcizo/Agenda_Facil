import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingData } from "../OnboardingPage";

interface AddressStepProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function AddressStep({ data, updateData, onNext, onBack }: AddressStepProps) {
  return (
    <div className="bg-stitch-surface-container-low/30 backdrop-blur-md rounded-[3rem] p-8 md:p-12 shadow-2xl border border-white/5 relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-stitch-secondary/5 rounded-full blur-[100px] -ml-32 -mb-32 pointer-events-none" />

      <div className="relative z-10 mb-10">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-stitch-secondary/10 flex items-center justify-center text-stitch-secondary shadow-inner">
            <span className="material-symbols-outlined text-2xl">location_on</span>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-stitch-on-surface tracking-tight font-headline">Localização</h2>
            <p className="text-sm text-stitch-on-surface-variant font-bold opacity-60">Onde seus clientes podem te encontrar?</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="space-y-3 md:col-span-1">
          <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">CEP</Label>
          <Input
            className="w-full h-14 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all px-5"
            placeholder="00000-000"
            value={data.cep}
            onChange={(e) => updateData({ cep: e.target.value })}
          />
        </div>

        <div className="space-y-3 md:col-span-3">
          <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Endereço Completo</Label>
          <Input
            className="w-full h-14 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all px-5"
            placeholder="Rua, Avenida, Praça..."
            value={data.address}
            onChange={(e) => updateData({ address: e.target.value })}
          />
        </div>

        <div className="space-y-3 md:col-span-2">
          <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Cidade</Label>
          <Input
            className="w-full h-14 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all px-5"
            placeholder="Ex: São Paulo"
            value={data.city}
            onChange={(e) => updateData({ city: e.target.value })}
          />
        </div>

        <div className="space-y-3 md:col-span-1">
          <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Estado</Label>
          <Input
            className="w-full h-14 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all px-5"
            placeholder="UF"
            maxLength={2}
            value={data.state}
            onChange={(e) => updateData({ state: e.target.value.toUpperCase() })}
          />
        </div>

        <div className="space-y-3 md:col-span-1">
          <Label className="text-xs font-black uppercase tracking-widest text-stitch-on-surface-variant ml-1">Número</Label>
          <Input
            className="w-full h-14 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all px-5"
            placeholder="123"
            value={data.number}
            onChange={(e) => updateData({ number: e.target.value })}
          />
        </div>
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/5">
        <Button variant="ghost" onClick={onBack} className="h-14 flex-1 rounded-2xl font-bold text-stitch-on-surface-variant opacity-60 hover:opacity-100 hover:bg-white/5">
          <span className="material-symbols-outlined text-lg mr-2">arrow_back</span>
          Voltar
        </Button>
        <Button onClick={onNext} className="h-14 flex-[2] rounded-2xl font-black shadow-xl shadow-stitch-primary/30 bg-stitch-primary text-white hover:scale-[1.02] active:scale-[0.98] transition-all">
          Salvar Endereço
          <span className="material-symbols-outlined text-lg ml-2">arrow_forward</span>
        </Button>
      </div>
    </div>
  );
}
