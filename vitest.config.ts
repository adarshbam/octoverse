import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/nox3d/**/*.test.ts'],
    environment: 'node',
  },
});
