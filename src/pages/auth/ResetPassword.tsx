import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const navigate = useNavigate();

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      toast.error("Token de recuperação não encontrado");
      navigate("/login");
      return;
    }

    const verifyToken = async () => {
      try {
        const { data, error } = await supabase.rpc('verify_reset_token', {
          reset_token: token
        });

        if (error) throw error;

        if (!data?.success) {
          toast.error(data?.message || "Token inválido ou expirado");
          setTimeout(() => navigate("/login"), 2000);
          return;
        }

        setTokenValid(true);
      } catch (err: unknown) {
        console.error('Error verifying token:', err);
        toast.error("Erro ao verificar token");
        setTimeout(() => navigate("/login"), 2000);
      } finally {
        setValidating(false);
      }
    };

    verifyToken();
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const { data: tokenData, error: tokenError } = await supabase.rpc('verify_reset_token', {
        reset_token: token
      });

      if (tokenError || !tokenData?.success) {
        toast.error("Token inválido ou expirado");
        return;
      }

      const { error: completeError } = await supabase.rpc('complete_password_reset', {
        reset_token: token,
        new_password: password
      });

      if (completeError) throw completeError;

      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => navigate("/login"), 2000);

    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error resetting password:', error);
      toast.error("Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white p-6 font-sans overflow-hidden relative">
      {/* Dynamic Background Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[60%] bg-stitch-primary/10 rounded-full blur-[150px] -z-10 animate-pulse transition-transform duration-[10s]"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-stitch-secondary/5 rounded-full blur-[150px] -z-10 animate-pulse" style={{ animationDelay: '3s' }}></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] -z-10"></div>

      <main className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-12 duration-1000">
        {/* Modern Logo Header */}
        <div className="text-center mb-12 group">
          <Link to="/login" className="inline-flex flex-col items-center justify-center mb-6">
            <div className="w-16 h-16 bg-stitch-primary rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(var(--primary-rgb),0.2)] mb-4 transform group-hover:rotate-12 transition-all duration-700">
              <span className="material-symbols-outlined text-white text-4xl font-black">calendar_month</span>
            </div>
            <h1 className="font-headline text-4xl font-black tracking-tighter text-white">
              Agenda<span className="text-stitch-primary">Fácil</span>
            </h1>
          </Link>
          <p className="text-white/40 font-bold tracking-[0.3em] text-[9px] uppercase">Acesso Seguro & Cloud</p>
        </div>

        {/* Reset Password Card */}
        <section className="bg-white/[0.03] backdrop-blur-2xl rounded-[3.5rem] p-12 shadow-2xl border border-white/5 relative overflow-hidden group/card ring-1 ring-white/10">
          {validating ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-pulse">
               <div className="w-20 h-20 border-[6px] border-stitch-primary/20 border-t-stitch-primary rounded-full animate-spin shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]" />
               <p className="text-white/40 font-black tracking-[0.4em] text-[10px] uppercase">Validando sua Identidade...</p>
            </div>
          ) : !tokenValid ? (
            <div className="text-center space-y-10 py-8 animate-in zoom-in-95 duration-500">
               <div className="w-24 h-24 bg-stitch-error/10 rounded-[2.5rem] mx-auto flex items-center justify-center text-stitch-error shadow-lg ring-1 ring-stitch-error/20">
                 <span className="material-symbols-outlined text-5xl font-black">report</span>
               </div>
               <div className="space-y-4">
                 <h2 className="font-headline font-black text-3xl text-white tracking-tight">Link Inválido</h2>
                 <p className="text-white/50 font-bold leading-relaxed px-4">Este link expirou por segurança ou já foi utilizado. Por favor, solicite um novo acesso.</p>
               </div>
               <Button onClick={() => navigate("/login")} className="w-full h-18 rounded-2xl bg-white/5 border border-white/10 text-white font-black hover:bg-white/10 transition-all text-lg">Ir para Login</Button>
            </div>
          ) : (
            <>
              <div className="mb-12 text-center md:text-left">
                <Badge className="bg-stitch-primary/10 text-stitch-primary border-0 px-4 py-1 rounded-full mb-4 font-black uppercase tracking-[0.2em] text-[10px]">Proteção Ativa</Badge>
                <h1 className="font-headline font-black text-4xl text-white tracking-tight mb-3">Nova Senha</h1>
                <p className="text-white/50 font-bold text-sm">Crie uma combinação ultra-segura para seu acesso.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-10">
                {/* Password Field */}
                <div className="space-y-4">
                  <Label className="block font-black text-[10px] uppercase tracking-widest text-white/40 ml-2" htmlFor="password">Nova Senha</Label>
                  <div className="relative group/input">
                    <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/input:text-stitch-primary transition-colors text-2xl">lock</span>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="w-full h-18 pl-14 pr-14 bg-[#1a1c1e]/50 border-white/5 rounded-2xl text-white placeholder:text-white/10 focus:ring-2 focus:ring-stitch-primary/50 focus:bg-[#1a1c1e] transition-all outline-none font-bold text-lg shadow-inner"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-stitch-primary transition-colors h-14 w-14 flex items-center justify-center rounded-2xl hover:bg-white/5"
                    >
                      <span className="material-symbols-outlined font-black text-2xl">{showPassword ? "visibility_off" : "visibility"}</span>
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-4">
                  <Label className="block font-black text-[10px] uppercase tracking-widest text-white/40 ml-2" htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <div className="relative group/input">
                    <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/input:text-stitch-primary transition-colors text-2xl">verified_user</span>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="w-full h-18 pl-14 pr-6 bg-[#1a1c1e]/50 border-white/5 rounded-2xl text-white placeholder:text-white/10 focus:ring-2 focus:ring-stitch-primary/50 focus:bg-[#1a1c1e] transition-all outline-none font-bold text-lg shadow-inner"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-20 bg-stitch-primary text-white font-black rounded-[2rem] shadow-[0_20px_40px_rgba(var(--primary-rgb),0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-xl group/btn overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_2s_infinite] pointer-events-none" />
                  {loading ? (
                    <div className="flex items-center gap-4">
                       <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                       <span>Atualizando...</span>
                    </div>
                  ) : (
                    <>
                      <span>Redefinir Senha</span>
                      <span className="material-symbols-outlined text-3xl transition-transform group-hover/btn:translate-x-2">check_circle</span>
                    </>
                  )}
                </Button>
              </form>
            </>
          )}
        </section>

        {/* Footer */}
        <footer className="w-full mt-16 flex flex-col items-center justify-center gap-6 opacity-30 hover:opacity-100 transition-opacity duration-700">
           <div className="flex flex-col items-center gap-4">
              <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.4em] text-center">Servidores protegidos por padrões globais de criptografia</span>
              <div className="flex gap-8">
                 <Link to="#" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-stitch-primary transition-colors">Segurança</Link>
                 <Link to="#" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-stitch-primary transition-colors">Status</Link>
                 <Link to="/login" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-stitch-primary transition-colors">Ajuda</Link>
              </div>
           </div>
        </footer>
      </main>
    </div>
  );
}
