import { defineConfig } from '@playwright/test';

// The creator's live preview (tests/e2e/platform-creator-live.spec.ts, platform Task 19b) against a PRODUCTION build, where the spec's timing bounds
// are asserted (against the dev server they are only recorded; PLATFORM_LOOSE_TIMING=1 opts out on a saturated machine):
//   npx vite build --outDir dist/m19b-prod --emptyOutDir
//   npx playwright test -c playwright.creator-live-prod.config.ts --workers=1
// Port 5197 is strict (PLATFORM_PREVIEW_PORT moves it when another session holds it).
const port = Number(process.env.PLATFORM_PREVIEW_PORT ?? 5197);
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'platform-creator-live.spec.ts',
  workers: 1,
  timeout: 120_000,
  use: { channel: 'msedge', baseURL: origin, launchOptions: { args: ['--ignore-gpu-blocklist'] } },
  webServer: { command: `npx vite preview --outDir dist/m19b-prod --port ${port} --strictPort`, url: origin, reuseExistingServer: false, timeout: 60_000 },
});
