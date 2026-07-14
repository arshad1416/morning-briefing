// lib/auth/useMe.ts — session state via React Query
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMe, type Me } from './api';

const ME_KEY = ['auth', 'me'] as const;

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ME_KEY,
    queryFn: fetchMe,
    staleTime: 60_000,
    retry: false,
  });
}

/** Call after login/logout/signup/checkout. Entitlements affect every gated
 *  query — and the screener even caches its gate state as a *successful*
 *  result — so drop the whole cache: premium data must not survive a logout,
 *  and stale teasers must not survive a sign-in. Active queries refetch
 *  automatically under the new session. */
export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.clear();
}
