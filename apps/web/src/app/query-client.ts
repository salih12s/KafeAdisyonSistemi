import { QueryClient, type Query } from '@tanstack/react-query';
import { AUTH_QUERY_KEY } from '../features/auth/hooks/use-auth';
import { ApiError } from '../shared/api/http';

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 401;
}

function isAuthQuery(query: Query): boolean {
  return query.queryKey[0] === AUTH_QUERY_KEY[0];
}

/**
 * Oturum düştüğünde (süre doldu, iptal edildi, çerez silindi) tek seferlik
 * temizlik yapar.
 *
 * Aynı anda düşen birçok 401 tek bir işleme indirgenir. Önce devam eden
 * istekler iptal edilir, sonra oturum sorgusu yeniden denenir: 401 dönerse
 * korumalı rotalar hata durumunu görüp giriş ekranına yönlenir. Oturum
 * sorgusunu silmek yerine yenilemek, korumalı bileşenlerin yeniden takılıp
 * istekleri tekrar tetiklemesini (401 döngüsü) önler. Son olarak önceki
 * kullanıcıya ait önbellek temizlenir.
 */
export function createUnauthorizedHandler(client: QueryClient): () => Promise<void> {
  let running: Promise<void> | undefined;

  const run = async (): Promise<void> => {
    await client.cancelQueries({ predicate: (query) => !isAuthQuery(query) });
    await client.refetchQueries({ queryKey: AUTH_QUERY_KEY });
    if (client.getQueryState(AUTH_QUERY_KEY)?.status === 'error') {
      client.removeQueries({ predicate: (query) => !isAuthQuery(query) });
    }
  };

  return () => {
    running ??= run().finally(() => {
      running = undefined;
    });
    return running;
  };
}

/** Sağlık sorgusunun gereksiz yere tekrarlanmasını sınırlayan ortak istemci ayarları. */
export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // 401 yeniden denemeyle düzelmez; yalnız geçici hatalar bir kez tekrarlanır.
        retry: (failureCount, error) => !isUnauthorized(error) && failureCount < 1,
        staleTime: 10_000,
        refetchOnWindowFocus: false,
      },
    },
  });

  const handleUnauthorized = createUnauthorizedHandler(client);
  window.addEventListener('kafe:unauthorized', () => {
    void handleUnauthorized();
  });

  return client;
}
