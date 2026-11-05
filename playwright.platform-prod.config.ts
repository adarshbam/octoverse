import { defineConfig } from '@playwright/test';

// The platform's resource and visitor-experience spec (tests/e2e/platform-resources.spec.ts, platform Task 16, spec 2.4) runs against a
// PRODUCTION build served by `vite preview`, not the dev server: the timing, heap and payload numbers of a dev build mean nothing.
//   npx vite build --outDir dist/m5-prod --emptyOutDir
//   npx playwright test -c playwright.platform-prod.config.ts --workers=1
// Port 5197 is strict and never reused (a server already there is somebody else's build). `--js-flags=--expose-gc` and
// `--enable-precise-memory-info` give the heap check a forced collection and an unrounded `performance.memory`.
// PLATFORM_PREVIEW_PORT moves it when another session holds 5197.
const port = Number(process.env.PLATFORM_PREVIEW_PORT ?? 5197);
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'platform-resources.spec.ts',
  workers: 1,
  timeout: 240_000,
  projects: [{ name: 'platform-prod' }],
  use: {
    channel: 'msedge',
    baseURL: origin,
    launchOptions: { args: ['--js-flags=--expose-gc', '--enable-precise-memory-info', '--ignore-gpu-blocklist'] },
  },
  webServer: { command: `npx vite preview --outDir dist/m5-prod --port ${port} --strictPort`, url: origin, reuseExistingServer: false, timeout: 60_000 },
});
