import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Os testes do prólogo inteiro levam ~25-30 s; com 30 s de limite eles falhavam conforme a carga da máquina.
  timeout: 60_000,
  outputDir: 'test-results',
  use: { baseURL: 'http://localhost:5173', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  // 1280 x 720 = exatamente 2x a resolução interna.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
