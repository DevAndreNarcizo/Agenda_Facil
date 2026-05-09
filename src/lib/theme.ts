type BrandTheme = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
};

const DEFAULT_PRIMARY = "#5343d4";
const DEFAULT_SECONDARY = "#006877";
const DEFAULT_ACCENT = "#904358";

function normalizeHexColor(value?: string | null) {
  const match = value?.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return null;

  const hex = match[1].length === 3
    ? match[1].split("").map((char) => `${char}${char}`).join("")
    : match[1];

  return `#${hex.toLowerCase()}`;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex) || DEFAULT_PRIMARY;
  const value = normalized.slice(1);

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function hexToHsl(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === red) {
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }

    hue /= 6;
  }

  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

function mix(hex: string, target: string, amount: number) {
  const sourceRgb = hexToRgb(hex);
  const targetRgb = hexToRgb(target);
  const channel = (source: number, targetValue: number) =>
    Math.round(source + (targetValue - source) * amount);

  return `#${[channel(sourceRgb.r, targetRgb.r), channel(sourceRgb.g, targetRgb.g), channel(sourceRgb.b, targetRgb.b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getReadableTextColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

function hslForTextColor(hex: string) {
  return getReadableTextColor(hex) === "#111827" ? "222.2 47.4% 11.2%" : "210 40% 98%";
}

export function applyOrganizationBrandTheme(theme: BrandTheme) {
  if (typeof document === "undefined") return;

  const primary = normalizeHexColor(theme.primaryColor) || DEFAULT_PRIMARY;
  const secondary = normalizeHexColor(theme.secondaryColor) || DEFAULT_SECONDARY;
  const accent = normalizeHexColor(theme.accentColor) || DEFAULT_ACCENT;
  const root = document.documentElement;
  const onPrimary = getReadableTextColor(primary);
  const onSecondary = getReadableTextColor(secondary);
  const onAccent = getReadableTextColor(accent);

  root.style.setProperty("--primary", hexToHsl(primary));
  root.style.setProperty("--primary-foreground", hslForTextColor(primary));
  root.style.setProperty("--ring", hexToHsl(primary));
  root.style.setProperty("--secondary", hexToHsl(secondary));
  root.style.setProperty("--secondary-foreground", hslForTextColor(secondary));
  root.style.setProperty("--accent", hexToHsl(accent));
  root.style.setProperty("--accent-foreground", hslForTextColor(accent));

  root.style.setProperty("--af-primary", primary);
  root.style.setProperty("--af-primary-hover", mix(primary, "#ffffff", 0.16));
  root.style.setProperty("--af-primary-deep", mix(primary, "#000000", 0.22));
  root.style.setProperty("--af-on-primary", onPrimary);
  root.style.setProperty("--af-primary-soft", withAlpha(primary, 0.1));
  root.style.setProperty("--af-primary-glow", withAlpha(primary, 0.28));

  root.style.setProperty("--af-secondary", secondary);
  root.style.setProperty("--af-on-secondary", onSecondary);
  root.style.setProperty("--af-secondary-container", mix(secondary, "#ffffff", 0.18));
  root.style.setProperty("--af-tertiary", accent);
  root.style.setProperty("--af-on-tertiary", onAccent);

  root.style.setProperty("--stitch-primary", primary);
  root.style.setProperty("--stitch-on-primary", onPrimary);
  root.style.setProperty("--stitch-primary-container", mix(primary, "#ffffff", 0.16));
  root.style.setProperty("--stitch-on-primary-container", onPrimary);
  root.style.setProperty("--stitch-secondary", secondary);
  root.style.setProperty("--stitch-on-secondary", onSecondary);
  root.style.setProperty("--stitch-secondary-container", mix(secondary, "#ffffff", 0.18));
  root.style.setProperty("--stitch-on-secondary-container", onSecondary);
  root.style.setProperty("--stitch-tertiary", accent);
  root.style.setProperty("--stitch-on-tertiary", onAccent);
  root.style.setProperty("--stitch-tertiary-container", mix(accent, "#ffffff", 0.16));
  root.style.setProperty("--stitch-on-tertiary-container", onAccent);
}
