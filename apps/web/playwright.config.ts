import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke test of the real stack: Vite + API + Postgres + Mailpit.
 * Requires `pnpm db:up` (docker compose) beforehand.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], locale: 'fr-FR' } }],
  webServer: [
    {
      command:
        'pnpm --filter @presidency-bingo/api generate && pnpm --filter @presidency-bingo/api dev',
      url: 'http://localhost:3000/api/health',
      env: { RATE_LIMIT_ENABLED: 'false' },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @presidency-bingo/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
