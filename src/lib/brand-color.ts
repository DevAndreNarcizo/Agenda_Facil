const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Valida uma cor hexadecimal (#rgb ou #rrggbb) vinda do banco antes de aplicá-la em CSS.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function isHexColor(value: string | null | undefined): value is string {
  return typeof value === "string" && HEX_PATTERN.test(value.trim());
}

/**
 * Converte #rrggbb no trio "H S% L%" usado pelas variáveis shadcn (`hsl(var(--primary))`).
 * Gravar o hex direto nessas variáveis gerava `hsl(#087bf5)`, uma cor inválida.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function hexToHslTriplet(hex: string): string {
  let value = hex.trim().replace("#", "");
  if (value.length === 3) value = value.split("").map((char) => char + char).join("");
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    hue = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    hue *= 60;
  }
  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}
