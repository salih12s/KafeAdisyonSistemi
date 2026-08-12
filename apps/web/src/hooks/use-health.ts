import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { HealthResponse } from '@kafe/contracts';
import { fetchHealth } from '../lib/api';

export const HEALTH_QUERY_KEY = ['health'] as const;

/** Sunucu ve veritabanı durumunu düzenli aralıklarla tazeler. */
export function useHealth(): UseQueryResult<HealthResponse, Error> {
  return useQuery({
    queryKey: HEALTH_QUERY_KEY,
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: 30_000,
    staleTime: 5_000,
  });
}
