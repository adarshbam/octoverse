import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/nox3d/**/*.test.ts', 'src/platform/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
