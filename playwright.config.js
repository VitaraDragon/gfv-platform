/**
 * Playwright E2E — GFV Farm Simulator v4 (browser su stack locale).
 * Prerequisiti: npm run sim:emulators + npm start + tenant sim_* in manifest (sim:run).
 * Esecuzione locale: `npm run sim:e2e` (scripts/sim-e2e-run.mjs). CLI nativa: `npm run sim:e2e:pw`.
 */
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const isExplore =
  process.env.GFV_E2E_MODE === 'explore' || process.env.GFV_E2E_FAST === '1';
/** Locale: Chrome di sistema (no download). CI: `sim:e2e:install` + Chromium bundled. */
const browserChannel =
  process.env.GFV_E2E_BROWSER_CHANNEL || (process.env.CI ? undefined : 'chrome');

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['./tests/e2e/sim/reporters/sim-diagnostic-reporter.mjs'],
  ],
  timeout: isExplore ? 45_000 : 120_000,
  expect: { timeout: isExplore ? 12_000 : 45_000 },
  use: {
    baseURL,
    ...(browserChannel ? { channel: browserChannel } : {}),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [
    {
      name: 'sim-chromium',
      testMatch: /tests\/e2e\/sim\/.*\.spec\.js/,
    },
  ],
});
