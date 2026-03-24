import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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
    <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white p-6 font-sans overflow-hidden relative">
      {/* Dynamic Background Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[60%] bg-stitch-primary/10 rounded-full blur-[150px] -z-10 animate-pulse active:scale-110 transition-transform duration-[10s]"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-stitch-secondary/5 rounded-full blur-[150px] -z-10 animate-pulse" style={{ animationDelay: '3s' }}></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] -z-10"></div>

      <main className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-12 duration-1000">
        {/* Modern Logo Header */}
        <div className="text-center mb-12 group">
          <div className="inline-flex flex-col items-center justify-center mb-6">
            <div className="w-20 h-20 bg-stitch-primary rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(var(--primary-rgb),0.3)] mb-4 transform group-hover:rotate-12 transition-all duration-700">
              <span className="material-symbols-outlined text-white text-5xl font-black">calendar_month</span>
            </div>
            <h1 className="font-headline text-5xl font-black tracking-tighter text-white">
              Agenda<span className="text-stitch-primary">Fácil</span>
            </h1>
          </div>
          <p className="text-white/40 font-bold tracking-[0.3em] text-[10px] uppercase">Seu Ecossistema de Produtividade</p>
        </div>

        {/* Premium Auth Card */}
        <section className="bg-white/[0.03] backdrop-blur-2xl rounded-[3.5rem] p-12 shadow-2xl border border-white/5 relative overflow-hidden group/card ring-1 ring-white/10">
          <div className="mb-12 text-center">
            <Badge className="bg-stitch-primary/10 text-stitch-primary border-0 px-4 py-1 rounded-full mb-4 font-black uppercase tracking-[0.2em] text-[10px]">Acesso Restrito</Badge>
            <h2 className="font-headline font-black text-4xl text-white tracking-tight mb-3">Bem-vindo</h2>
            <p className="text-white/50 font-bold text-sm">Entre no seu estúdio de gestão digital.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Email Field */}
            <div className="space-y-3">
              <Label className="block font-black text-[10px] uppercase tracking-widest text-white/40 ml-2" htmlFor="email">Email Corporativo</Label>
              <div className="relative group/input">
                <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/input:text-stitch-primary transition-colors text-2xl">mail</span>
                <Input
                  className="w-full h-18 pl-14 pr-6 bg-[#1a1c1e]/50 border-white/5 rounded-2xl text-white placeholder:text-white/10 focus:ring-2 focus:ring-stitch-primary/50 focus:bg-[#1a1c1e] transition-all outline-none font-bold text-lg shadow-inner"
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-[10px] text-stitch-error font-black uppercase tracking-wider ml-2 animate-in fade-in slide-in-from-left-2">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <Label className="block font-black text-[10px] uppercase tracking-widest text-white/40 ml-2" htmlFor="password">Chave de Acesso</Label>
                <Link to="/forgot-password" title="Recuperar senha" className="text-[10px] font-black text-stitch-primary hover:text-stitch-primary/80 transition-all uppercase tracking-widest">
                  Esqueci a Senha
                </Link>
              </div>
              <div className="relative group/input">
                <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/input:text-stitch-primary transition-colors text-2xl">lock</span>
                <Input
                  className="w-full h-18 pl-14 pr-6 bg-[#1a1c1e]/50 border-white/5 rounded-2xl text-white placeholder:text-white/10 focus:ring-2 focus:ring-stitch-primary/50 focus:bg-[#1a1c1e] transition-all outline-none font-bold text-lg shadow-inner"
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <p className="text-[10px] text-stitch-error font-black uppercase tracking-wider ml-2 animate-in fade-in slide-in-from-left-2">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="p-5 rounded-2xl bg-stitch-error/10 border border-stitch-error/20 flex items-center gap-4 animate-in shake-1">
                <div className="w-10 h-10 rounded-xl bg-stitch-error/20 flex items-center justify-center text-stitch-error">
                  <span className="material-symbols-outlined text-2xl font-black">warning</span>
                </div>
                <p className="text-xs text-stitch-error font-black leading-tight">{error}</p>
              </div>
            )}

            {/* Action Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-20 bg-stitch-primary text-white font-black rounded-[2rem] shadow-[0_20px_40px_rgba(var(--primary-rgb),0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-xl group/btn overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_2s_infinite] pointer-events-none" />
              {loading ? (
                <div className="flex items-center gap-4">
                   <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                   <span>Verificando...</span>
                </div>
              ) : (
                <>
                  Entrar no Painel
                  <span className="material-symbols-outlined text-3xl transition-transform group-hover/btn:translate-x-2">arrow_right_alt</span>
                </>
              )}
            </Button>
          </form>

          {/* Secondary Action */}
          <div className="mt-12 text-center pt-8 border-t border-white/5">
            <p className="text-sm text-white/40 font-bold">
              Novo no estúdio?{" "}
              <Link to="/register" className="font-black text-stitch-primary hover:text-white transition-all underline decoration-stitch-primary/30 decoration-4 underline-offset-8">
                Crie seu ambiente grátis
              </Link>
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full mt-16 flex flex-col items-center justify-center gap-6 opacity-30 hover:opacity-100 transition-opacity duration-700">
           <div className="flex flex-col items-center gap-4">
              <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.4em] text-center">AgendaFácil Digital Concierge • Premium SAAS Architecture</span>
              <div className="flex gap-8">
                 <Link to="#" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-stitch-primary transition-colors">Termos</Link>
                 <Link to="#" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-stitch-primary transition-colors">Privacidade</Link>
                 <Link to="#" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-stitch-primary transition-colors">Suporte Cloud</Link>
              </div>
           </div>
        </footer>
      </main>
    </div>
  );
}
