'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            // Don't retry errors the user has to act on (auth, validation, not found…).
            retry: (count, err) =>
              count < 2 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        {children}
        <Toaster position="bottom-right" theme="system" richColors closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
