import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest "globals: false" ile çalıştığı için otomatik temizleme elle bağlanır.
afterEach(() => {
  cleanup();
});
