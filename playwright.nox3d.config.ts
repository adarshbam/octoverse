import { defineConfig } from '@playwright/test';

// Each lane runs its own dev server; NOX_PORT keeps reuseExistingServer from testing another lane's.
const port = Number(process.env.NOX_PORT ?? 5191);
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  // Three browsers at once at most, so the WebGL pages do not crowd the GPU. No check depends on it
  // for time: the entrance's first-visit check counts page-clock steps, and its time limit grows
  // with them (tests/e2e/entrance.spec.ts).
  workers: 3,
  use: { channel: 'msedge', baseURL: origin },
  webServer: { command: `npx vite --port ${port} --strictPort`, url: origin, reuseExistingServer: true },
});
