import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright visual regression and DOM geometry verification config.
 * Configured specifically for OctoVerse Milestone A01.
 * Uses a dedicated loopback Vite server on strict port 5178.
 */
export default defineConfig({
  testDir: './tests/visual',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:5178',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 507, height: 505 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: 'npx vite --port 5178 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
