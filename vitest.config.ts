import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/engine/**/*.test.ts', 'src/worlds/**/*.test.ts', 'src/platform/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
