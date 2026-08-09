// app/providers/query-provider.tsx
"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  const isDevelopment = process.env.NODE_ENV === "development";

  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    children,
    isDevelopment && React.createElement(ReactQueryDevtools, { initialIsOpen: false })
  );
}