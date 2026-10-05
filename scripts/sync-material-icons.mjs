import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanMaterialIcons } from './material-icons-scan.mjs';

/**
 * Regenera os ícones do app:
 * 1. src/lib/material-icons.ts com os nomes usados no código;
 * 2. src/assets/fonts/material-symbols-outlined.woff2, a fonte variável (peso 100–700, FILL 0–1)
 *    só com esses glifos, baixada uma vez do Google Fonts e servida pelo próprio app.
 * Hospedar a fonte evita depender do Google em tempo de execução (rede bloqueada, CSP, LGPD).
 * Uso: npm run icons:sync (o teste material-icons.test.ts indica quando é necessário).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const icons = scanMaterialIcons(root);
const body = icons.map((name) => `  '${name}',`).join('\n');

writeFileSync(
  join(root, 'src/lib/material-icons.ts'),
  `// Arquivo gerado por scripts/sync-material-icons.mjs — não edite à mão (npm run icons:sync).
/**
 * Ícones Material Symbols usados pelo app. A fonte em src/assets/fonts/material-symbols-outlined.woff2
 * contém exatamente estes glifos; rode \`npm run icons:sync\` ao usar um ícone novo.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const MATERIAL_ICONS: readonly string[] = [
${body}
];
`,
);

// O Google exige icon_names em ordem alfabética; o User-Agent moderno garante a resposta em woff2.
const cssUrl =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1' +
  `&icon_names=${[...icons].sort().join(',')}&display=block`;
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const cssResponse = await fetch(cssUrl, { headers: { 'User-Agent': userAgent } });
if (!cssResponse.ok) throw new Error(`Google Fonts respondeu ${cssResponse.status} para a lista de ícones.`);
const fontUrl = (await cssResponse.text()).match(/url\((https:[^)]+)\)\s*format\('woff2'\)/)?.[1];
if (!fontUrl) throw new Error('Resposta do Google Fonts sem arquivo woff2.');

const fontResponse = await fetch(fontUrl, { headers: { 'User-Agent': userAgent } });
if (!fontResponse.ok) throw new Error(`Falha ao baixar a fonte (${fontResponse.status}).`);
const font = Buffer.from(await fontResponse.arrayBuffer());

mkdirSync(join(root, 'src/assets/fonts'), { recursive: true });
writeFileSync(join(root, 'src/assets/fonts/material-symbols-outlined.woff2'), font);

console.log(`material-icons.ts atualizado com ${icons.length} ícones; fonte com ${(font.length / 1024).toFixed(1)} KB.`);
