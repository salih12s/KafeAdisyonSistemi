import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { DemoInfoResponse } from '@kafe/contracts';
import { fetchDemoInfo } from './api';

export const DEMO_QUERY_KEY = ['demo', 'info'] as const;

/**
 * Sunucunun demo modunda olup olmadığı. Demo verisi yenilenirken birkaç
 * saniyede bir tekrar sorulur; bitince giriş düğmeleri kendiliğinden açılır.
 */
export function useDemoInfo(): UseQueryResult<DemoInfoResponse, Error> {
  return useQuery({
    queryKey: DEMO_QUERY_KEY,
    queryFn: fetchDemoInfo,
    retry: false,
    staleTime: 60_000,
    refetchInterval: (query) => (query.state.data?.resetting === true ? 5_000 : false),
  });
}
