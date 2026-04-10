import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.js', 'packages/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
