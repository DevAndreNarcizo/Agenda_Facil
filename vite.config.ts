import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

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
  plugins: [react()],
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
