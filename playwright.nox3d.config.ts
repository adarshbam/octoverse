import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Three browsers at once at most: the entrance's first-visit check steps a paused clock frame by
  // frame and runs out of time when a fourth renders alongside it.
  workers: 3,
  use: { channel: 'msedge', baseURL: 'http://localhost:5191' },
  webServer: { command: 'npx vite --port 5191 --strictPort', url: 'http://localhost:5191', reuseExistingServer: true },
});
