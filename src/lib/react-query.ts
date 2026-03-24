import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Não retentar erros 400, 403, 404 (são definitivos)
        const status = (error as { status?: number })?.status;
        if (status && [400, 403, 404, 422].includes(status)) return false;
        return failureCount < 1;
      },
    },
  },
});
