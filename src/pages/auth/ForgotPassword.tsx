import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';

/**
 * Solicita a recuperação de senha por meio do fluxo nativo do Supabase Auth.
 *
 * @author André Narcizo
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  /**
   * Envia um link de recuperação sem revelar se o e-mail existe na base.
   *
   * @author André Narcizo
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      setSent(true);
      toast.success('Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.');
    } catch (error: unknown) {
      console.error('Erro ao solicitar recuperação de senha:', error);
      toast.error('Não foi possível solicitar a recuperação de senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-6 text-white">
      <main className="w-full max-w-lg">
        <div className="mb-12 text-center">
          <Link to="/login" className="inline-flex flex-col items-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-stitch-primary">
              <span className="material-symbols-outlined text-4xl">calendar_month</span>
            </div>
            <h1 className="font-headline text-4xl font-black">Agenda<span className="text-stitch-primary">Fácil</span></h1>
          </Link>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Recuperação de credenciais</p>
        </div>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 shadow-2xl md:p-12">
          {sent ? (
            <div className="space-y-8 text-center">
              <span className="material-symbols-outlined text-6xl text-stitch-primary">mail</span>
              <div>
                <h2 className="font-headline text-3xl font-black">Verifique seu e-mail</h2>
                <p className="mt-4 text-white/60">Se o endereço informado estiver cadastrado, enviaremos instruções para redefinir sua senha.</p>
              </div>
              <Button className="h-14 w-full rounded-2xl" onClick={() => navigate('/login')}>Voltar para login</Button>
            </div>
          ) : (
            <>
              <Badge className="mb-4 bg-stitch-primary/10 text-stitch-primary">Acesso seguro</Badge>
              <h2 className="font-headline text-3xl font-black">Esqueceu a senha?</h2>
              <p className="mt-3 text-sm text-white/60">Informe seu e-mail para receber um link de recuperação.</p>
              <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail de cadastro</Label>
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="h-14 rounded-xl bg-white/5" />
                </div>
                <Button type="submit" disabled={loading} className="h-14 w-full rounded-2xl">
                  {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                </Button>
                <Link to="/login" className="block text-center text-sm font-semibold text-white/60 hover:text-stitch-primary">Voltar para login</Link>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
