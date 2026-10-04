import { useCallback, useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "theme";
const listeners = new Set<() => void>();

/**
 * Lê o tema efetivo direto da classe do <html>, que é a fonte de verdade aplicada no main.tsx.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function readMode(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Inscreve um ouvinte para mudanças de tema feitas por qualquer componente.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Aplica e persiste o tema, notificando todos os consumidores (header, Configurações, ThemeToggle).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function applyThemeMode(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Armazenamento indisponível (modo privado): o tema vale apenas para a sessão atual.
  }
  listeners.forEach((listener) => listener());
}

/**
 * Hook único de tema claro/escuro, sincronizado entre todos os componentes montados.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function useThemeMode() {
  const mode = useSyncExternalStore(subscribe, readMode, () => "light" as ThemeMode);
  const toggle = useCallback(() => applyThemeMode(readMode() === "dark" ? "light" : "dark"), []);
  return { mode, setMode: applyThemeMode, toggle };
}
