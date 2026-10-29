import { ErrorCode } from '@presidency-bingo/shared';
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api';
import { currentElectionQuery } from './elections';

export const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
  mutationCache: new MutationCache({
    // The server locked predictions before this page noticed: refetch so the UI turns read-only.
    onError: (error) => {
      if (error instanceof ApiRequestError && error.code === ErrorCode.PREDICTIONS_LOCKED) {
        void queryClient.invalidateQueries({ queryKey: currentElectionQuery.queryKey });
      }
    },
  }),
});
