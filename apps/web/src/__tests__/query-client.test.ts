import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { AUTH_QUERY_KEY } from '../hooks/use-auth';
import { ApiError } from '../lib/api';
import { createUnauthorizedHandler } from '../lib/query-client';
import { userForRole } from '../test/render';

const TABLES_KEY = ['floor-plan'] as const;

async function primedClient(meResponses: Array<() => Promise<unknown>>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fetchMe = vi.fn(() => {
    const next = meResponses.shift();
    if (next === undefined) throw new Error('Beklenmeyen /api/auth/me çağrısı.');
    return next();
  });
  await client.prefetchQuery({ queryKey: AUTH_QUERY_KEY, queryFn: fetchMe });
  await client.prefetchQuery({ queryKey: TABLES_KEY, queryFn: () => ({ areas: [] }) });
  return { client, fetchMe };
}

describe('Oturum düştüğünde (401) önbellek temizliği', () => {
  it('aynı anda gelen 401 olaylarını tek oturum kontrolüne indirger ve önbelleği temizler', async () => {
    const owner = userForRole('OWNER');
    const { client, fetchMe } = await primedClient([
      () => Promise.resolve(owner),
      () => Promise.reject(new ApiError('Oturum bulunamadı.', 401)),
    ]);
    const handle = createUnauthorizedHandler(client);

    await Promise.all([handle(), handle(), handle()]);

    // İlk yükleme + tek bir yeniden kontrol; 401 fırtınası yok.
    expect(fetchMe).toHaveBeenCalledTimes(2);
    expect(client.getQueryState(AUTH_QUERY_KEY)?.status).toBe('error');
    // Önceki kullanıcıya ait veriler önbellekte kalmaz.
    expect(client.getQueryData(TABLES_KEY)).toBeUndefined();
  });

  it('oturum hâlâ geçerliyse önbelleğe dokunmaz', async () => {
    const owner = userForRole('OWNER');
    const { client } = await primedClient([
      () => Promise.resolve(owner),
      () => Promise.resolve(owner),
    ]);

    await createUnauthorizedHandler(client)();

    expect(client.getQueryState(AUTH_QUERY_KEY)?.status).toBe('success');
    expect(client.getQueryData(TABLES_KEY)).toEqual({ areas: [] });
  });
});
