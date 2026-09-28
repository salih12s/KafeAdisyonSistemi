import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    // Gerçek veritabanı ister; vitest.integration.config.ts ile ayrıca çalışır.
    exclude: ['tests/integration/**'],
    maxWorkers: 2,
    restoreMocks: true,
    testTimeout: 10_000,
  },
});
