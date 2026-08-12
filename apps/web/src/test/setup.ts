import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 5_000 });

// Vitest "globals: false" ile çalıştığı için otomatik temizleme elle bağlanır.
afterEach(() => {
  cleanup();
});
