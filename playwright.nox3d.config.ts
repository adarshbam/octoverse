import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Three browsers at once at most, so the WebGL pages do not crowd the GPU. No check depends on it
  // for time: the entrance's first-visit check counts page-clock steps, and its time limit grows
  // with them (tests/e2e/entrance.spec.ts).
  workers: 3,
  use: { channel: 'msedge', baseURL: 'http://localhost:5191' },
  webServer: { command: 'npx vite --port 5191 --strictPort', url: 'http://localhost:5191', reuseExistingServer: true },
});
