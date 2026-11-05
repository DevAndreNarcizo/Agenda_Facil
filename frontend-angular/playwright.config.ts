import { defineConfig, devices } from '@playwright/test';

/**
 * E2E do fluxo de piloto: Angular (4200) + backend Laravel (8000) com SQLite efêmero.
 * O webServer sobe os dois; os testes validam a integração ponta a ponta.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    // Usa o chromium já disponível no ambiente quando definido.
    channel: undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Permite usar um Chromium já presente no ambiente (sandbox) via env; em CI,
        // `playwright install chromium` provê o browser e a variável fica vazia.
        launchOptions: process.env['PLAYWRIGHT_CHROMIUM_PATH']
          ? { executablePath: process.env['PLAYWRIGHT_CHROMIUM_PATH'] }
          : {},
      },
    },
  ],
  webServer: [
    {
      command: 'bash e2e/start-backend.sh',
      url: 'http://127.0.0.1:8000/up',
      timeout: 120_000,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'npx ng serve --port 4200 --host 127.0.0.1',
      url: 'http://localhost:4200',
      timeout: 120_000,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
