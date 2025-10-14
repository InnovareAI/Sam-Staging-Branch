'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  // Create QueryClient inside component to avoid sharing across requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data stays fresh for 5 minutes
            staleTime: 5 * 60 * 1000,
            // Cache data for 30 minutes
            gcTime: 30 * 60 * 1000,
            // Refetch when window regains focus
            refetchOnWindowFocus: true,
            // Retry failed requests 2 times
            retry: 2,
            // Prevent data vanishing during refetch
            refetchOnMount: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
