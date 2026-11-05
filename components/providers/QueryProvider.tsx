'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds stale time (prevents duplicate fetches on rapid navigation)
            gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
            refetchOnWindowFocus: false, // Prevents sudden background refetches while typing or scanning
            refetchOnMount: false, // Uses cached data if within staleTime
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
