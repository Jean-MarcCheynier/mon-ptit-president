import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke test of the real stack: Vite + API + Postgres + Mailpit.
 * Requires `pnpm db:up` (docker compose) beforehand.
 *
 * `SMOKE_ISOLATED=1` (`pnpm test:smoke:isolated`) starts a dedicated API and Vite on other ports,
 * so the suite can run while `pnpm dev` is up without touching it (nor its rate limit).
 */
const isolated = !!process.env.SMOKE_ISOLATED && !process.env.CI;
const apiPort = isolated ? 3001 : 3000;
const webPort = isolated ? 5174 : 5173;
const webUrl = `http://localhost:${webPort}`;

const api = {
  url: `http://localhost:${apiPort}/api/health`,
  timeout: 120_000,
  env: { RATE_LIMIT_ENABLED: 'false' },
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: webUrl,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], locale: 'fr-FR' } }],
  webServer: isolated
    ? [
        {
          ...api,
          // Compiled into its own folder: `nest start` would wipe the dev server's `dist`.
          command:
            'pnpm --filter @presidency-bingo/api exec tsc -p tsconfig.build.json --outDir dist-smoke && pnpm --filter @presidency-bingo/api exec node dist-smoke/main.js',
          env: { ...api.env, PORT: String(apiPort), APP_URL: webUrl },
          reuseExistingServer: false,
        },
        {
          command: `pnpm --filter @presidency-bingo/web exec vite --port ${webPort} --strictPort`,
          url: webUrl,
          env: {
            API_PROXY_TARGET: `http://localhost:${apiPort}`,
            VITE_CACHE_DIR: 'node_modules/.vite-smoke',
          },
          reuseExistingServer: false,
        },
      ]
    : [
        {
          ...api,
          command:
            'pnpm --filter @presidency-bingo/api generate && pnpm --filter @presidency-bingo/api dev',
          reuseExistingServer: !process.env.CI,
        },
        {
          command: 'pnpm --filter @presidency-bingo/web dev',
          url: webUrl,
          reuseExistingServer: !process.env.CI,
        },
      ],
});
