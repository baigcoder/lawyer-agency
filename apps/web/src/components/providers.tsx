'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/lib/theme';
import { LanguageProvider } from '@/lib/language';

/**
 * Client-side providers. QueryClient is created per-app-instance in state
 * (creating it at module scope would share cache across requests/users in
 * any SSR-adjacent path — a real multi-tenant leak class).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster richColors closeButton />
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
