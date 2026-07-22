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
            // 401/403 gate responses are deterministic — retrying them just
            // burns Worker invocations for signed-out/under-tier users.
            retry: (count, err) => !(err instanceof GateError) && count < 2,
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
