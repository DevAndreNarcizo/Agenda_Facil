import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPortalOtp, verifyPortalOtp } from "@/lib/portal-api";
import { getPublicBookingReturnUrl, getPublicBookingSlug } from "@/lib/portal-return-url";
import { toast } from "sonner";

export default function PortalLogin() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const returnUrl = getPublicBookingReturnUrl(location.search);
  const organizationSlug = getPublicBookingSlug(returnUrl);

  /**
   * Formata o telefone brasileiro durante a digitação.
   *
   * @author André Narcizo
   */
  const formatPhone = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanPhone = phone.replace(/\D/g, '');
      await requestPortalOtp(cleanPhone, organizationSlug);
      toast.success('Se o número estiver cadastrado, o código será enviado pelo WhatsApp.');
      setStep('otp');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error sending code:', error);
      toast.error("Erro ao enviar código. Verifique o número e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanPhone = phone.replace(/\D/g, '');
      await verifyPortalOtp(cleanPhone, code, organizationSlug);
      toast.success("Login realizado com sucesso!");
      navigate(returnUrl ?? "/portal", { replace: true });

    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error verifying code:', error);
      toast.error("Erro ao verificar código. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setCode('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stitch-surface text-stitch-on-surface p-6 font-body overflow-hidden relative">
      {/* Decorative Blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[45%] h-[45%] bg-stitch-primary/10 rounded-full blur-[140px] -z-10 animate-pulse"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-stitch-secondary-container/15 rounded-full blur-[140px] -z-10 animate-pulse" style={{ animationDelay: '3s' }}></div>

      <main className="w-full max-w-md animate-in fade-in slide-in-from-bottom-10 duration-1000">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-4 bg-stitch-surface-container-lowest rounded-[2rem] shadow-xl shadow-stitch-primary/10 mb-6 transition-transform hover:scale-105 duration-500">
             <span className="material-symbols-outlined text-stitch-primary text-5xl font-black">schedule</span>
          </div>
          <h1 className="font-headline text-4xl font-black text-stitch-on-surface tracking-tighter mb-2">Portal do Cliente</h1>
          <p className="text-stitch-on-surface-variant font-medium opacity-60">Acesse para gerenciar seus agendamentos.</p>
        </div>

        <section className="bg-stitch-surface-container-low/30 backdrop-blur-xl rounded-[2.5rem] p-10 shadow-2xl shadow-stitch-primary/5 border border-stitch-outline-variant/10 relative overflow-hidden">
          {step === 'phone' ? (
            <>
              <div className="mb-10">
                <h2 className="font-headline font-black text-3xl text-stitch-on-surface tracking-tight mb-2">Bem-vindo(a)!</h2>
                <p className="text-stitch-on-surface-variant font-medium">Informe seu celular para acessar.</p>
              </div>

              <form onSubmit={handleSendCode} className="space-y-8">
                <div className="space-y-3">
                  <Label className="block font-bold text-sm text-stitch-on-surface-variant ml-1" htmlFor="phone">Seu Celular (WhatsApp)</Label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stitch-outline opacity-50 group-focus-within:text-stitch-primary transition-colors">phone_iphone</span>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      className="w-full h-16 pl-12 pr-4 bg-stitch-surface-container-low/50 border-stitch-outline-variant/20 rounded-2xl text-stitch-on-surface placeholder:text-stitch-outline/30 focus:ring-4 focus:ring-stitch-primary/10 transition-all outline-none font-black text-xl tracking-tight"
                      value={phone}
                      onChange={handlePhoneChange}
                      maxLength={15}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-16 bg-stitch-primary text-white font-black rounded-2xl shadow-xl shadow-stitch-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg group/btn"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Receber Código</span>
                      <span className="material-symbols-outlined text-2xl transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
                    </>
                  )}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-10">
                <h2 className="font-headline font-black text-3xl text-stitch-on-surface tracking-tight mb-2">Quase lá!</h2>
                <p className="text-stitch-on-surface-variant font-medium">Digite o código de 6 dígitos que enviamos.</p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-8">
                <div className="space-y-4">
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stitch-outline opacity-50 text-xl">password</span>
                    <Input
                      id="code"
                      type="text"
                      placeholder="000000"
                      className="w-full h-20 pl-12 pr-4 bg-stitch-surface-container-low/50 border-stitch-outline-variant/20 rounded-2xl text-stitch-on-surface placeholder:text-stitch-outline/20 focus:ring-4 focus:ring-stitch-primary/10 transition-all outline-none font-black text-4xl text-center tracking-[0.5em]"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-sm font-bold text-stitch-on-surface-variant text-center opacity-60">
                    Enviado para <span className="text-stitch-primary">{phone}</span>
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <Button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="w-full h-16 bg-stitch-primary text-white font-black rounded-2xl shadow-xl shadow-stitch-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg"
                  >
                    {loading ? (
                       <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span>Validar e Entrar</span>
                    )}
                  </Button>

                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full h-14 rounded-2xl text-stitch-on-surface-variant font-black hover:bg-stitch-surface transition-all gap-2" 
                    onClick={handleBackToPhone}
                    disabled={loading}
                  >
                    <span className="material-symbols-outlined text-xl">edit</span>
                    Alterar Número
                  </Button>
                </div>
              </form>
            </>
          )}

          {/* Decorative Corner */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-stitch-primary/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
        </section>

        {/* Brand Footer */}
        <div className="text-center mt-12 opacity-40">
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stitch-on-surface-variant">Powered by AgendaFácil Design System</p>
        </div>
      </main>
    </div>
  );
}
