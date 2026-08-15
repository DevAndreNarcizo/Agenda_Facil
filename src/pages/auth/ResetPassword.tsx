import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';

/**
 * Permite definir uma nova senha durante uma sessão de recuperação do Supabase Auth.
 *
 * @author André Narcizo
 */
export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [canResetPassword, setCanResetPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    /**
     * Confirma que o redirecionamento do Supabase criou uma sessão de recuperação válida.
     *
     * @author André Narcizo
     */
    const validateRecoverySession = async (): Promise<void> => {
      const { data, error } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (error || !data.session) {
        setCanResetPassword(false);
        setValidating(false);
        return;
      }

      setCanResetPassword(true);
      setValidating(false);
    };

    void validateRecoverySession();

    return () => {
      active = false;
    };
  }, []);

  /**
   * Atualiza a senha da sessão de recuperação ativa e encerra a sessão temporária.
   *
   * @author André Narcizo
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (password !== confirmation) {
      toast.error('As senhas não coincidem.');
      return;
    }

    if (password.length < 8) {
      toast.error('A senha deve ter ao menos 8 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      await supabase.auth.signOut();
      toast.success('Senha redefinida com sucesso. Faça login novamente.');
      navigate('/login', { replace: true });
    } catch (error: unknown) {
      console.error('Erro ao redefinir senha:', error);
      toast.error('Não foi possível redefinir a senha. Solicite um novo link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-6 text-white">
      <main className="w-full max-w-lg">
        <div className="mb-12 text-center">
          <Link to="/login" className="inline-flex flex-col items-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-stitch-primary"><span className="material-symbols-outlined text-4xl">lock_reset</span></div>
            <h1 className="font-headline text-4xl font-black">Agenda<span className="text-stitch-primary">Fácil</span></h1>
          </Link>
        </div>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 shadow-2xl md:p-12">
          {validating ? (
            <p className="py-12 text-center text-white/60">Validando link de recuperação...</p>
          ) : !canResetPassword ? (
            <div className="space-y-6 text-center">
              <span className="material-symbols-outlined text-6xl text-stitch-error">error</span>
              <div><h2 className="font-headline text-3xl font-black">Link inválido ou expirado</h2><p className="mt-3 text-white/60">Solicite uma nova recuperação de senha para continuar.</p></div>
              <Button className="h-14 w-full rounded-2xl" onClick={() => navigate('/forgot-password')}>Solicitar novo link</Button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div><h2 className="font-headline text-3xl font-black">Defina sua nova senha</h2><p className="mt-3 text-sm text-white/60">Use pelo menos 8 caracteres.</p></div>
              <div className="space-y-2"><Label htmlFor="password">Nova senha</Label><Input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="h-14 rounded-xl bg-white/5" /></div>
              <div className="space-y-2"><Label htmlFor="confirmation">Confirmar nova senha</Label><Input id="confirmation" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-14 rounded-xl bg-white/5" /></div>
              <Button type="submit" disabled={loading} className="h-14 w-full rounded-2xl">{loading ? 'Atualizando...' : 'Redefinir senha'}</Button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
