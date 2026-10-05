// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { materialFontSize, scanMaterialIcons } from '../../../scripts/material-icons-scan.mjs';
import { MATERIAL_ICONS } from '../material-icons';

describe('material-icons', () => {
  it('lista todos os ícones usados no código (rode `npm run icons:sync` se falhar)', () => {
    // Raiz do repositório a partir deste arquivo (sem depender dos tipos do Node no tsconfig do app).
    const root = decodeURIComponent(new URL('../../../', import.meta.url).pathname);
    const used = scanMaterialIcons(root);
    const missing = used.filter((name) => !MATERIAL_ICONS.includes(name));
    expect(missing).toEqual([]);
  });

  it('tem a fonte local gerada pelo icons:sync (o app não carrega ícones do Google Fonts)', () => {
    const root = decodeURIComponent(new URL('../../../', import.meta.url).pathname);
    expect(materialFontSize(root)).toBeGreaterThan(1024);
  });
});
