import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: { screenshot: 'only-on-failure' },
  projects: [
    { name: 'api', testMatch: '**/*.api.spec.mjs' },
    { name: 'e2e', testMatch: '**/*.e2e.spec.mjs', use: { ...devices['Desktop Chrome'] } },
  ],
});
