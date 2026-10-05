import type { SupportedStorage } from "@supabase/supabase-js";

const REMEMBER_KEY = "af-remember-session";

/**
 * Executa um acesso a Web Storage tolerando navegação privada e cookies bloqueados.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function safely<T>(action: () => T, fallback: T): T {
  try {
    return action();
  } catch {
    return fallback;
  }
}

/**
 * Indica se a sessão deve sobreviver ao fechamento do navegador ("Manter conectado").
 * Padrão: sim, que é o comportamento esperado em celular.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function shouldRememberSession(): boolean {
  return safely(() => localStorage.getItem(REMEMBER_KEY) !== "0", true);
}

/**
 * Grava a preferência "Manter conectado". Deve ser chamada antes de autenticar,
 * para a sessão nova já nascer no armazenamento certo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function setRememberSession(remember: boolean): void {
  safely(() => localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0"), undefined);
}

/**
 * Armazenamento da sessão do Supabase Auth que respeita "Manter conectado":
 * com a opção marcada usa localStorage (persiste); desmarcada, sessionStorage (some ao fechar a aba).
 * Cada escrita remove a cópia do outro armazenamento para nunca existirem duas sessões.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const authStorage: SupportedStorage = {
  getItem: (key) => safely(() => sessionStorage.getItem(key), null) ?? safely(() => localStorage.getItem(key), null),
  setItem: (key, value) => {
    const remember = shouldRememberSession();
    safely(() => (remember ? localStorage : sessionStorage).setItem(key, value), undefined);
    safely(() => (remember ? sessionStorage : localStorage).removeItem(key), undefined);
  },
  removeItem: (key) => {
    safely(() => localStorage.removeItem(key), undefined);
    safely(() => sessionStorage.removeItem(key), undefined);
  },
};
