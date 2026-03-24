import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { OnboardingData } from "../OnboardingPage";

interface HoursStepProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
  saving?: boolean;
}

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const hour = Math.floor(i / 2).toString().padStart(2, '0');
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour}:${minute}`;
});

export function HoursStep({ data, updateData, onNext, onBack, saving }: HoursStepProps) {
  const schedule = data.schedule;

  const toggleDay = (index: number) => {
    const updated = schedule.map((item, i) => (i === index ? { ...item, active: !item.active } : item));
    updateData({ schedule: updated });
  };

  const updateTime = (index: number, field: 'start' | 'end', value: string) => {
    const updated = schedule.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    updateData({ schedule: updated });
  };

  return (
    <div className="bg-stitch-surface-container-low/30 backdrop-blur-md rounded-[3rem] p-6 md:p-12 shadow-2xl border border-white/5 relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-stitch-primary/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />

      <div className="relative z-10 mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-stitch-primary/10 flex items-center justify-center text-stitch-primary shadow-inner">
            <span className="material-symbols-outlined text-2xl">schedule</span>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-stitch-on-surface tracking-tight font-headline">Horários de Funcionamento</h2>
            <p className="text-sm text-stitch-on-surface-variant font-bold opacity-60">Defina em quais dias e horários você atende.</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 space-y-3 mb-10 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {schedule.map((day, index) => (
          <div
            key={day.label}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl transition-all duration-300 border",
              day.active
                ? "bg-stitch-primary/5 border-stitch-primary/20 shadow-sm"
                : "bg-[#1a1c1e]/50 border-white/5 opacity-60"
            )}
          >
            <div className="flex items-center gap-4 w-full sm:w-auto mb-4 sm:mb-0">
              <Switch
                checked={day.active}
                onCheckedChange={() => toggleDay(index)}
              />
              <div className="flex flex-col">
                <span className="font-black text-stitch-on-surface text-base leading-tight">{day.label}</span>
                <span className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  day.active ? "text-stitch-primary" : "text-stitch-on-surface-variant"
                )}>
                  {day.active ? "Aberto para agendamentos" : "Fechado"}
                </span>
              </div>
            </div>

            {day.active && (
              <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center">
                  <span className="text-xs font-bold text-stitch-on-surface-variant opacity-50 uppercase mb-1">Início</span>
                  <select
                    value={day.start}
                    onChange={(e) => updateTime(index, 'start', e.target.value)}
                    className="bg-[#1a1c1e] text-white rounded-xl px-3 py-2.5 border border-white/10 font-black text-sm outline-none focus:ring-2 focus:ring-stitch-primary/30 transition-all cursor-pointer shadow-inner"
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="w-4 h-[2px] bg-stitch-on-surface-variant opacity-20 mt-4" />
                <div className="flex flex-col items-center">
                  <span className="text-xs font-bold text-stitch-on-surface-variant opacity-50 uppercase mb-1">Fim</span>
                  <select
                    value={day.end}
                    onChange={(e) => updateTime(index, 'end', e.target.value)}
                    className="bg-[#1a1c1e] text-white rounded-xl px-3 py-2.5 border border-white/10 font-black text-sm outline-none focus:ring-2 focus:ring-stitch-primary/30 transition-all cursor-pointer shadow-inner"
                  >
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/5">
        <Button variant="ghost" onClick={onBack} disabled={saving} className="h-14 flex-1 rounded-2xl font-bold text-stitch-on-surface-variant opacity-60 hover:opacity-100 hover:bg-white/5">
          <span className="material-symbols-outlined text-lg mr-2">arrow_back</span>
          Voltar
        </Button>
        <Button
          onClick={onNext}
          disabled={saving}
          className="h-14 flex-[2] rounded-2xl font-black shadow-xl shadow-stitch-primary/30 bg-stitch-primary text-white hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          {saving ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Criando sua empresa...</span>
            </div>
          ) : (
            <>
              Finalizar e Criar Empresa
              <span className="material-symbols-outlined text-lg ml-2">check_circle</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
