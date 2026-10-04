import path from 'path';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { MATERIAL_ICONS } from './src/lib/material-icons';

/**
 * Restringe o Material Symbols aos glifos usados (`icon_names=`, em ordem alfabética, como a API exige).
 * A fonte variável completa tem ~1,1 MB; o subconjunto tem dezenas de KB.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function materialSymbolsSubset(): Plugin {
  return {
    name: 'material-symbols-subset',
    transformIndexHtml(html) {
      const names = [...MATERIAL_ICONS].sort().join(',');
      return html.replace(
        /(https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined[^"]*?)(&display=)/,
        `$1&icon_names=${names}$2`,
      );
    },
  };
}

/**
 * Agrupa dependências estáveis em chunks próprios: mudam pouco entre deploys,
 * então continuam no cache do navegador quando só o código do app muda.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return 'vendor-react';
  if (id.includes('node_modules/@supabase/')) return 'vendor-supabase';
  if (id.includes('node_modules/@tanstack/')) return 'vendor-query';
  if (id.includes('node_modules/@radix-ui/')) return 'vendor-radix';
  return undefined;
}

export default defineConfig({
  plugins: [react(), materialSymbolsSubset()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: { manualChunks: vendorChunk },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    clearMocks: true,
  },
});
