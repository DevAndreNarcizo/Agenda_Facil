import { useEffect } from 'react';
import { useOrganization } from '@/hooks/use-organization';
import { hexToHslTriplet, isHexColor } from '@/lib/brand-color';

/**
 * Aplica a cor da marca da organização às variáveis shadcn (`--primary`/`--ring`).
 * Converte o hex salvo para o trio HSL esperado; antes, o hex cru gerava `hsl(#...)` inválido.
 * O painel refinado usa os tokens `--af-*` e não é afetado. Reaproveita o cache de useOrganization.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function useOrganizationTheme() {
  const { organization } = useOrganization();
  const primaryColor = organization?.primary_color;

  useEffect(() => {
    if (!isHexColor(primaryColor)) return;
    const root = document.documentElement;
    const triplet = hexToHslTriplet(primaryColor);
    root.style.setProperty('--primary', triplet);
    root.style.setProperty('--ring', triplet);
    return () => {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
    };
  }, [primaryColor]);
}
