import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    exclude: ['src/generated/**', 'node_modules/**'],
    environment: 'node',
  },
});
