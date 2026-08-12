import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { CurrentUser } from '@kafe/contracts';
import { fetchCurrentUser } from '../lib/api';

export const AUTH_QUERY_KEY = ['auth', 'current-user'] as const;

export function useCurrentUser(): UseQueryResult<CurrentUser, Error> {
  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 30_000,
  });
}
