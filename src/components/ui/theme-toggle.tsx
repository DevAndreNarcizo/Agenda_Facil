import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeMode } from "@/hooks/use-theme-mode";

/**
 * Toggle de tema claro/escuro usado nas telas fora do painel; compartilha estado via useThemeMode.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function ThemeToggle() {
  const { toggle } = useThemeMode();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      className="relative"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
}
