import { ErrorCode } from '@presidency-bingo/shared';
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api';
import { currentElectionQuery } from './elections';
import { phasesQuery } from './phases';

export const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
  mutationCache: new MutationCache({
    // The server closed (or hasn't opened) a phase this page thought open: refetch the election
    // and the phases so the UI follows the server's clock.
    onError: (error) => {
      if (
        error instanceof ApiRequestError &&
        (error.code === ErrorCode.PREDICTIONS_LOCKED ||
          error.code === ErrorCode.PREDICTIONS_NOT_OPEN)
      ) {
        void queryClient.invalidateQueries({ queryKey: currentElectionQuery.queryKey });
        void queryClient.invalidateQueries({ queryKey: phasesQuery.queryKey });
      }
    },
  }),
});
