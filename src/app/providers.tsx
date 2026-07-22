// app/providers.tsx — QueryClientProvider wrapper
'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GateError } from '@/lib/api/gated';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // 401/403 gate responses (signin/upgrade) are deterministic —
            // retrying them just burns Worker invocations for signed-out or
            // under-tier users. GateError('unavailable') wraps transient
            // failures (network blip, Worker 5xx) and retries normally.
            retry: (count, err) =>
              !(err instanceof GateError && err.kind !== 'unavailable') && count < 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
