import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { channel: 'msedge', baseURL: 'http://localhost:5191' },
  webServer: { command: 'npx vite --port 5191 --strictPort', url: 'http://localhost:5191', reuseExistingServer: true },
});
