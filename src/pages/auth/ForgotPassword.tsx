import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('request_password_reset', {
        user_email: email
      });

      if (error) throw error;

      if (data?.simulated_link) {
        toast.success("Link de recuperação gerado!", {
          duration: 15000,
          description: `Simulação (Desenvolvimento): ${data.simulated_link}`,
          action: {
            label: "Copiar",
            onClick: () => {
              navigator.clipboard.writeText(data.simulated_link);
              toast.success("Link copiado!");
            }
          }
        });
      } else {
        toast.success(data?.message || "Se o email existir, você receberá instruções de recuperação");
      }

      setSent(true);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error requesting password reset:', error);
      toast.error("Erro ao solicitar recuperação de senha");
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
          <p className="text-white/40 font-bold tracking-[0.3em] text-[9px] uppercase">Recuperação de Credenciais</p>
        </div>

        {/* Forgot Password Card */}
        <section className="bg-white/[0.03] backdrop-blur-2xl rounded-[3.5rem] p-12 shadow-2xl border border-white/5 relative overflow-hidden group/card ring-1 ring-white/10">
          {sent ? (
            <div className="text-center space-y-10 animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-stitch-primary/10 rounded-[2rem] mx-auto flex items-center justify-center text-stitch-primary shadow-lg ring-1 ring-stitch-primary/20">
                <span className="material-symbols-outlined text-5xl font-black">mail</span>
              </div>
              <div className="space-y-4">
                <h2 className="font-headline font-black text-3xl text-white tracking-tight">Email Enviado!</h2>
                <p className="text-white/50 font-bold leading-relaxed px-4">
                  Se o endereço <span className="text-white font-black underline decoration-stitch-primary/30 underline-offset-8 decoration-4">{email}</span> estiver na base, as instruções chegarão em instantes.
                </p>
              </div>
              <Button 
                variant="outline" 
                className="w-full h-16 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-black gap-3 transition-all text-lg" 
                onClick={() => navigate("/login")}
              >
                <span className="material-symbols-outlined text-2xl">arrow_back</span>
                Fazer Login
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-12 text-center md:text-left">
                <Badge className="bg-stitch-primary/10 text-stitch-primary border-0 px-4 py-1 rounded-full mb-4 font-black uppercase tracking-[0.2em] text-[10px]">Criptografia de Ponta</Badge>
                <h2 className="font-headline font-black text-4xl text-white tracking-tight mb-3">Esqueceu a senha?</h2>
                <p className="text-white/50 font-bold text-sm">Não se preocupe, redefinir é rápido e seguro.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-10">
                {/* Email Field */}
                <div className="space-y-4">
                  <Label className="block font-black text-[10px] uppercase tracking-widest text-white/40 ml-2" htmlFor="email">Email de Cadastro</Label>
                  <div className="relative group/input">
                    <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/input:text-stitch-primary transition-colors text-2xl">mail</span>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      className="w-full h-18 pl-14 pr-6 bg-[#1a1c1e]/50 border-white/5 rounded-2xl text-white placeholder:text-white/10 focus:ring-2 focus:ring-stitch-primary/50 focus:bg-[#1a1c1e] transition-all outline-none font-bold text-lg shadow-inner"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
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
                       <span>Enviando...</span>
                    </div>
                  ) : (
                    <>
                      <span>Solicitar Código</span>
                      <span className="material-symbols-outlined text-3xl transition-transform group-hover/btn:translate-x-2">send</span>
                    </>
                  )}
                </Button>

                <div className="text-center pt-2">
                  <Link 
                    to="/login" 
                    className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-stitch-primary transition-all group/back"
                  >
                    <span className="material-symbols-outlined text-lg transition-transform group-hover/back:-translate-x-1">arrow_back</span>
                    Voltar para Login
                  </Link>
                </div>
              </form>
            </>
          )}
        </section>

        {/* Footer */}
        <footer className="w-full mt-16 flex flex-col items-center justify-center gap-6 opacity-30 hover:opacity-100 transition-opacity duration-700">
           <div className="flex flex-col items-center gap-4">
              <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.4em] text-center">Protegido por protocolos de segurança avançados</span>
              <div className="flex gap-8">
                 <Link to="#" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-stitch-primary transition-colors">Políticas</Link>
                 <Link to="#" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-stitch-primary transition-colors">Ajuda</Link>
                 <Link to="/login" className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-stitch-primary transition-colors">Suporte</Link>
              </div>
           </div>
        </footer>
      </main>
    </div>
  );
}
