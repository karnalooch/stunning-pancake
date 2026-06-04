import { defineConfig, devices } from '@playwright/test';

/**
 * SPORT Admin Dashboard — Playwright E2E Test Configuration
 *
 * Critical paths covered:
 *   1. Login flow (JWT token storage)
 *   2. Live Tracking view renders map
 *   3. Navigation between all 5 views
 *   4. Events view loads API data
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  snapshotPathTemplate: '{testDir}/live-map-zoom-snapshots/{arg}{ext}',
  reporter: [
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'e2e-results.xml' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.E2E_SKIP_WEB_SERVER
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          VITE_E2E: '1',
          VITE_API_URL: '/api',
        },
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/live-map-zoom.spec.ts',
    },
    {
      name: 'live-map-zoom',
      testMatch: '**/live-map-zoom.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testIgnore: '**/live-map-zoom.spec.ts',
    },
  ],
});
