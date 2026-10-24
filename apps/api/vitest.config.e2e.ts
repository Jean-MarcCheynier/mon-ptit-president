import { loadEnvFile } from 'node:process';
import { defineConfig } from 'vitest/config';

loadEnvFile('.env.test');

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Tests share one database.
    fileParallelism: false,
    env: { ...process.env } as Record<string, string>,
  },
});
