import { Button } from "@/components/ui/button";

interface SuccessStepProps {
  onFinish: () => void;
}

export function SuccessStep({ onFinish }: SuccessStepProps) {
  return (
    <div className="flex flex-col items-center text-center space-y-10 py-16 px-8 bg-stitch-surface-container-low/30 backdrop-blur-md rounded-[3rem] shadow-2xl border border-white/5 relative overflow-hidden">
      {/* Decorative glows */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-stitch-primary/10 rounded-full blur-[120px] -mr-40 -mt-40 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-stitch-secondary/5 rounded-full blur-[120px] -ml-40 -mb-40 pointer-events-none" />

      <div className="relative z-10 w-24 h-24 rounded-[2rem] bg-stitch-primary/10 flex items-center justify-center text-stitch-primary animate-bounce shadow-inner">
        <span className="material-symbols-outlined text-6xl">check_circle</span>
      </div>

      <div className="relative z-10 space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-stitch-on-surface tracking-tight font-headline">Tudo Pronto!</h1>
        <p className="text-lg text-stitch-on-surface-variant font-medium max-w-lg mx-auto leading-relaxed opacity-60">
          Sua conta foi configurada com sucesso. Agora você já pode acessar seu painel e começar a gerenciar seus agendamentos.
        </p>
      </div>

      <Button
        onClick={onFinish}
        className="relative z-10 h-16 px-12 rounded-2xl text-lg font-black gap-3 shadow-xl shadow-stitch-primary/30 hover:scale-[1.03] active:scale-[0.97] transition-all bg-stitch-primary text-white"
      >
        Ir para o Dashboard
        <span className="material-symbols-outlined text-xl">dashboard</span>
      </Button>

      <p className="relative z-10 text-sm font-bold text-stitch-on-surface-variant opacity-40 uppercase tracking-widest pt-2">
        Prepare-se para crescer com o AgendaFácil!
      </p>
    </div>
  );
}
