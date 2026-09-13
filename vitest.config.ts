import { defineConfig } from 'vitest/config';

// Calculation engine is framework-free TypeScript, so tests run without booting Astro.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
