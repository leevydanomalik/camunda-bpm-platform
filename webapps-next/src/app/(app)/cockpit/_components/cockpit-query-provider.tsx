"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Local QueryClientProvider for the cockpit dashboard.
 * No global provider exists in webapps-next today; this keeps
 * the dashboard self-contained and avoids forcing react-query
 * onto pages that don't need it.
 */
export function CockpitQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
