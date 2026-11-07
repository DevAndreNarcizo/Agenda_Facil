// Tira screenshots das telas principais da nova stack (Angular + Laravel) com dados SINTÉTICOS.
// Pré-requisitos: backend em :8000 (DemoSeeder) e SPA servida em :4200.
// Uso: node scripts/demo/capture.mjs <dir_saida>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(new URL('../../frontend-angular/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const out = process.argv[2] ?? 'docs/demo/screens';
mkdirSync(out, { recursive: true });

const base = 'http://localhost:4200';
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('response', async (r) => { if (r.url().includes('/api/v1/') && process.env.DEBUG_API) console.log(r.status(), r.url().slice(0,150)); });
page.on('console', (m) => { if (process.env.DEBUG_API && m.type()==='error') console.log('CONSOLE', m.text().slice(0,200)); });
const shot = async (name) => {
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
  console.log('ok', name);
};

await page.goto(`${base}/register`);
await shot('01b-cadastro');
await page.goto(`${base}/login`);
await shot('01-login');

await page.getByLabel('E-mail').fill('demo@agendafacil.example');
await page.getByLabel('Senha').fill('demo-staging-123');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForURL(/\/dashboard$/);
await page.waitForFunction(() => [...document.querySelectorAll('.kpi-value')].length > 0 && ![...document.querySelectorAll('.kpi-value')].some((e) => e.textContent.trim() === '—'));
await shot('02-dashboard');

const pages = [
  ['03-agenda', '/agenda'],
  ['04-clientes', '/customers'],
  ['05-servicos', '/services'],
  ['06-profissionais', '/professionals'],
  ['07-analytics', '/analytics'],
  ['08-configuracoes', '/settings'],
  ['09-assinatura', '/subscription'],
  ['10-planos', '/plans'],
];
for (const [name, path] of pages) {
  await page.goto(`${base}${path}`);
  await shot(name);
}

// Reserva pública (cliente externo) em desktop e mobile.
await page.goto(`${base}/reservar/studio-demo`);
await shot('11-reserva-publica-desktop');
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/reservar/studio-demo`);
await shot('12-reserva-publica-mobile');

// Painel no celular (barra inferior).
await page.goto(`${base}/dashboard`);
await shot('13-dashboard-mobile');

await browser.close();
