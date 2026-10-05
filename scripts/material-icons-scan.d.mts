/** Varre src/ e retorna os ícones Material Symbols usados (ver material-icons-scan.mjs). */
export function scanMaterialIcons(rootDir: string): string[];

/** Tamanho em bytes da fonte local de ícones (0 se ausente). */
export function materialFontSize(rootDir: string): number;
