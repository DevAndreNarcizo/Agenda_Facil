import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Varre o código-fonte e retorna os nomes de ícones Material Symbols usados.
 *
 * Considera todo literal de string e todo texto JSX que coincida com um nome oficial
 * (scripts/data/material-symbols-names.txt). É um superconjunto seguro: cobre ícones
 * dinâmicos (mapas, ternários, props) sem depender de padrões frágeis de markup.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function scanMaterialIcons(rootDir) {
  const valid = new Set(
    readFileSync(join(rootDir, 'scripts/data/material-symbols-names.txt'), 'utf8').split('\n').filter(Boolean),
  );
  const found = new Set();

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry !== '__tests__') walk(path);
      } else if (/\.tsx?$/.test(entry) && !entry.endsWith('database.types.ts') && !entry.endsWith('material-icons.ts')) {
        const source = readFileSync(path, 'utf8');
        const tokens = [
          ...source.matchAll(/["'`]([a-z0-9_]{3,})["'`]/g),
          ...source.matchAll(/>\s*([a-z0-9_]{3,})\s*</g),
        ];
        for (const [, token] of tokens) if (valid.has(token)) found.add(token);
      }
    }
  };

  walk(join(rootDir, 'src'));
  return [...found].sort();
}

/**
 * Tamanho em bytes da fonte local de ícones (0 se ainda não foi gerada por `npm run icons:sync`).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function materialFontSize(rootDir) {
  const font = join(rootDir, 'src/assets/fonts/material-symbols-outlined.woff2');
  return existsSync(font) ? statSync(font).size : 0;
}
