import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCep, getCepDigits } from "@/lib/cep";
import type { OnboardingData } from "../OnboardingPage";

type CepLookupStatus = "idle" | "loading" | "found" | "not-found" | "error";

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

interface AddressStepProps {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function AddressStep({ data, updateData, onNext, onBack }: AddressStepProps) {
  const [cepStatus, setCepStatus] = useState<CepLookupStatus>("idle");

  useEffect(() => {
    const cepDigits = getCepDigits(data.cep);

    if (cepDigits.length !== 8) {
      setCepStatus("idle");
      return;
    }

    const controller = new AbortController();

    const lookupCep = async () => {
      setCepStatus("loading");

      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Erro ao consultar CEP.");
        }

        const result = (await response.json()) as ViaCepResponse;

        if (result.erro) {
          setCepStatus("not-found");
          return;
        }

        updateData({
          ...(result.logradouro ? { address: result.logradouro } : {}),
          ...(result.localidade ? { city: result.localidade } : {}),
          ...(result.uf ? { state: result.uf } : {}),
        });
        setCepStatus("found");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setCepStatus("error");
      }
    };

    void lookupCep();

    return () => controller.abort();
  }, [data.cep, updateData]);

  const handleCepChange = (value: string) => {
    updateData({ cep: formatCep(value) });
  };

  const cepHelpMessage = {
    idle: "Digite 8 números para buscar o endereço.",
    loading: "Buscando endereço pelo CEP...",
    found: "Endereço identificado automaticamente.",
    "not-found": "CEP não encontrado. Preencha o endereço manualmente.",
    error: "Não foi possível consultar o CEP agora. Preencha manualmente.",
  }[cepStatus];

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
          <div className="relative">
            <Input
              className="w-full h-14 rounded-2xl border-none bg-[#1a1c1e] text-white font-bold placeholder:text-white/20 shadow-inner focus-visible:ring-2 focus-visible:ring-stitch-primary/50 transition-all px-5 pr-12"
              placeholder="00000-000"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={9}
              value={data.cep}
              onChange={(e) => handleCepChange(e.target.value)}
            />
            {cepStatus === "loading" ? (
              <span className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-stitch-primary/30 border-t-stitch-primary animate-spin" />
            ) : cepStatus === "found" ? (
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-stitch-secondary text-xl">check_circle</span>
            ) : null}
          </div>
          <p
            className={`text-[11px] font-bold ml-1 ${
              cepStatus === "found"
                ? "text-stitch-secondary"
                : cepStatus === "not-found" || cepStatus === "error"
                  ? "text-stitch-tertiary"
                  : "text-stitch-on-surface-variant opacity-50"
            }`}
            aria-live="polite"
          >
            {cepHelpMessage}
          </p>
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
