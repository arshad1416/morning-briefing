// lib/hooks/useMediaQuery.ts — SSR-safe matchMedia subscription.
'use client';

import { useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // Static-export server snapshot; anything layout-critical must be
    // reserved in CSS, not derived from this hook.
    () => false,
  );
}
