import { defineConfig } from 'vitest/config';

// Um worker evita disputar processos de banco, builds e navegador no mesmo ambiente local.
export default defineConfig({ test: { maxWorkers: 1 } });
