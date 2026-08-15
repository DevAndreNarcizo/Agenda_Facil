import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { AuthContext } from './auth-context-types';
import type { AuthContextType, Profile } from './auth-context-types';

/**
 * Aguarda um intervalo curto antes de tentar novamente uma consulta transitória.
 *
 * @author André Narcizo
 */
function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

/**
 * Disponibiliza sessão e perfil autenticado para toda a aplicação.
 *
 * @author André Narcizo
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Obtém o perfil com poucas tentativas para cobrir a criação assíncrona pelo trigger do Auth.
   *
   * @author André Narcizo
   */
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        return data as Profile;
      }

      if (attempt < 2) {
        await sleep(500 * (attempt + 1));
      }
    }

    return null;
  }, []);

  /**
   * Sincroniza todos os estados dependentes de uma sessão antes de liberar a interface.
   *
   * @author André Narcizo
   */
  const synchronizeSession = useCallback(async (nextSession: Session | null): Promise<void> => {
    setLoading(true);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const nextProfile = await fetchProfile(nextSession.user.id);
    setProfile(nextProfile);
    setLoading(false);
  }, [fetchProfile]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => synchronizeSession(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void synchronizeSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, [synchronizeSession]);

  /**
   * Encerra a sessão e limpa imediatamente os dados protegidos do contexto.
   *
   * @author André Narcizo
   */
  const signOut = async (): Promise<void> => {
    setProfile(null);
    await supabase.auth.signOut();
  };

  /**
   * Recarrega o perfil do usuário autenticado.
   *
   * @author André Narcizo
   */
  const refreshProfile = async (): Promise<void> => {
    if (!user) {
      return;
    }

    setProfile(await fetchProfile(user.id));
  };

  const value: AuthContextType = { session, user, profile, loading, signOut, refreshProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
