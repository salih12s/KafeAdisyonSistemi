import { defineConfig } from 'vitest/config';

/**
 * Gerçek MySQL/MariaDB gerektiren integration testleri (tests/integration).
 * `npm run test` bunları çalıştırmaz; `npm run test:db` ile ayrıca çalışır.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/integration/**/*.test.ts'],
    // Testler aynı veritabanını paylaşır; dosyalar sırayla çalışır.
    fileParallelism: false,
    restoreMocks: true,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
