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

/** Call after login/logout/signup/checkout so every consumer re-reads the session. */
export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ME_KEY });
}
