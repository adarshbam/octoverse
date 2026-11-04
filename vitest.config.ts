import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/nox3d/**/*.test.ts', 'src/engine/**/*.test.ts', 'src/worlds/**/*.test.ts'],
    environment: 'node',
  },
});
