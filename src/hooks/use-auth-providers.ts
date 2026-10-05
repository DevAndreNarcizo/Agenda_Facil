import { useQuery } from "@tanstack/react-query";
import { supabaseConfig } from "@/lib/supabase";
import { parseAuthProviders, type AuthProviders } from "@/lib/auth-form";

const NONE: AuthProviders = { google: false, whatsapp: false };

/**
 * Descobre, em tempo de execução, quais métodos extras de login estão ativos no Supabase Auth
 * (GET /auth/v1/settings). Assim os botões Google/WhatsApp aparecem assim que o provedor é
 * ligado no painel do Supabase, sem novo deploy, e nunca aparecem quebrados antes disso.
 * Em qualquer falha a resposta é "nenhum", mantendo só e-mail e senha. `ready` indica que a consulta terminou.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function useAuthProviders(): AuthProviders & { ready: boolean } {
  const { data, isFetched } = useQuery({
    queryKey: ["auth-providers"],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${supabaseConfig.url}/auth/v1/settings`, {
        headers: { apikey: supabaseConfig.anonKey },
        signal,
      });
      if (!response.ok) return NONE;
      return parseAuthProviders(await response.json());
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  return { ...(data ?? NONE), ready: isFetched };
}
