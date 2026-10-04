import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanMaterialIcons } from './material-icons-scan.mjs';

/**
 * Regenera src/lib/material-icons.ts com os ícones usados no app.
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
 * Ícones Material Symbols usados pelo app. O vite.config.ts injeta esta lista em
 * \`icon_names=\` no link do Google Fonts, baixando só esses glifos em vez da fonte inteira (~1,1 MB).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export const MATERIAL_ICONS: readonly string[] = [
${body}
];
`,
);

console.log(`material-icons.ts atualizado com ${icons.length} ícones.`);
