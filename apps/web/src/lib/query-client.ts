import { QueryClient } from '@tanstack/react-query';

/**
 * Yerel ağda çalışıldığı için istekler ucuzdur; yine de gereksiz
 * yeniden isteklerin kasa bilgisayarını meşgul etmemesi için ölçülü ayarlar.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 10_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}
