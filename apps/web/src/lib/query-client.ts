import { QueryClient } from '@tanstack/react-query';

/** Sağlık sorgusunun gereksiz yere tekrarlanmasını sınırlayan ortak istemci ayarları. */
export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 10_000,
        refetchOnWindowFocus: false,
      },
    },
  });

  window.addEventListener('kafe:unauthorized', () => {
    client.removeQueries({ queryKey: ['auth'] });
  });

  return client;
}
