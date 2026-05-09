import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;

      navigate("/dashboard");
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Email ou senha incorretos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-[#050505] text-white lg:grid-cols-[1.05fr_1fr]">
      <div className="pointer-events-none absolute -left-[8%] -top-[15%] h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(83,67,212,0.55),transparent_60%)] blur-[40px]" />
      <div className="pointer-events-none absolute bottom-[-20%] right-[5%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(63,225,253,0.28),transparent_60%)] blur-[50px]" />

      <section className="relative z-10 hidden min-h-screen flex-col justify-between p-10 lg:flex xl:p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#5343d4] to-[#6d5fef] shadow-[0_10px_24px_rgba(83,67,212,0.5)]">
            <span className="material-symbols-outlined text-xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>event_available</span>
          </div>
          <div className="font-headline text-lg font-black tracking-[-0.025em]">
            Agenda<span className="text-[#9e91ff]">Fácil</span>
          </div>
        </div>

        <div>
          <div className="af-eb mb-3.5 text-[#9e91ff] opacity-85">Acesso restrito</div>
          <h1 className="m-0 font-headline text-[44px] font-black leading-none tracking-[-0.035em]">
            O estúdio digital<br />
            do seu <span className="bg-gradient-to-r from-[#9e91ff] to-[#3fe1fd] bg-clip-text text-transparent">tempo</span>.
          </h1>
          <p className="mt-3.5 max-w-[420px] text-sm font-medium leading-relaxed text-white/65">
            Agenda, clientes, equipe e financeiro em um só lugar.
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            {[
              ["bolt", "Auto-agendamento via WhatsApp"],
              ["insights", "Receita em tempo real"],
              ["lock", "Multi-tenant com tema próprio"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-2.5 text-[13px] font-semibold text-white/85">
                <div className="flex h-6 w-6 items-center justify-center rounded-[7px] border border-white/10 bg-white/[0.06]">
                  <span className="material-symbols-outlined text-sm text-[#9e91ff]">{icon}</span>
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3.5 text-[11px] font-semibold text-white/45">
          <span>© 2026 AgendaFácil</span><span>·</span><span>Termos</span><span>·</span><span>Privacidade</span>
        </div>
      </section>

      <main className="relative z-10 flex min-h-screen items-center justify-center p-6 sm:p-10">
        <section className="w-full max-w-[380px] rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-7 backdrop-blur-2xl sm:p-8">
          <div className="mb-5 lg:hidden">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#5343d4] to-[#6d5fef]">
                <span className="material-symbols-outlined text-xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>event_available</span>
              </div>
              <div className="font-headline text-lg font-black tracking-[-0.025em]">
                Agenda<span className="text-[#9e91ff]">Fácil</span>
              </div>
            </div>
          </div>

          <div className="mb-5">
            <div className="af-eb mb-1.5 text-[#9e91ff]">Bem-vindo de volta</div>
            <h2 className="m-0 font-headline text-[26px] font-black tracking-[-0.025em] text-white">Entrar no painel</h2>
            <p className="mt-1 text-xs font-medium text-white/60">Acesse seu estúdio com o e-mail cadastrado.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <Label className="af-eb mb-1.5 block text-[9px] text-white/55" htmlFor="email">E-mail</Label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-white/50">mail</span>
                <Input
                  className="h-11 rounded-[11px] border-white/[0.08] bg-[#1a1c1e] pl-10 pr-3 text-[13px] font-medium text-white placeholder:text-white/30 focus-visible:ring-[#9e91ff]/40"
                  id="email"
                  type="email"
                  placeholder="voce@estudio.com"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="ml-1 mt-1.5 text-[10px] font-black uppercase tracking-wider text-[#ff8a8a]">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="af-eb text-[9px] text-white/55" htmlFor="password">Senha</Label>
                <Link to="/forgot-password" className="text-[11px] font-bold text-[#9e91ff] transition-colors hover:text-white">
                  Esqueceu?
                </Link>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-white/50">lock</span>
                <Input
                  className="h-11 rounded-[11px] border-white/[0.08] bg-[#1a1c1e] pl-10 pr-3 text-[13px] font-medium text-white placeholder:text-white/30 focus-visible:ring-[#9e91ff]/40"
                  id="password"
                  type="password"
                  placeholder="••••••"
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <p className="ml-1 mt-1.5 text-[10px] font-black uppercase tracking-wider text-[#ff8a8a]">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between pb-1 pt-0.5">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-white/75">
                <input type="checkbox" className="h-3 w-3 accent-[#9e91ff]" defaultChecked />
                Manter conectado
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-[#ff8a8a]/20 bg-[#ff8a8a]/10 p-3">
                <span className="material-symbols-outlined text-xl text-[#ff8a8a]">warning</span>
                <p className="text-xs font-bold leading-tight text-[#ff8a8a]">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="mt-1 flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#5343d4] text-[13px] font-black text-white shadow-[0_10px_24px_rgba(83,67,212,0.4)] transition-transform hover:bg-[#6d5fef] active:scale-[0.98]"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                   <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                   <span>Verificando...</span>
                </div>
              ) : (
                <>
                  Entrar no painel
                  <span className="material-symbols-outlined text-base">arrow_right_alt</span>
                </>
              )}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-2.5 text-white/40">
            <div className="h-px flex-1 bg-white/10" />
            <span className="af-eb text-[9px]">Ou</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button type="button" className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-bold text-white transition-colors hover:bg-white/[0.08]">
            <span className="material-symbols-outlined text-base">alternate_email</span>
            Continuar com convite
          </button>

          <div className="mt-4 text-center text-xs text-white/65">
            Não tem conta?{" "}
              <Link to="/register" className="font-extrabold text-[#9e91ff] hover:text-white">
                Criar agora
              </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
