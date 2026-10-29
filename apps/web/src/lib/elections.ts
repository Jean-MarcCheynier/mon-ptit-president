import { type CurrentElectionDto, ErrorCode } from '@presidency-bingo/shared';
import { queryOptions } from '@tanstack/react-query';
import { ApiRequestError, api } from './api';
import { useIsPast } from './time';

/** The upcoming election, or null when none is scheduled. */
export const currentElectionQuery = queryOptions({
  queryKey: ['elections', 'current'],
  queryFn: async (): Promise<CurrentElectionDto | null> => {
    try {
      return await api<CurrentElectionDto>('/elections/current');
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === ErrorCode.NO_CURRENT_ELECTION) {
        return null;
      }
      throw error;
    }
  },
  staleTime: 5 * 60 * 1000,
});

/**
 * Whether predictions are locked: as reported by the server, or since the deadline passed while
 * the page was open. A refused write refetches the election (see query-client), which fixes a
 * skewed local clock.
 */
export function usePredictionsLocked(election: CurrentElectionDto | null): boolean {
  const passed = useIsPast(election?.predictionsLockAt);
  return election !== null && (election.predictionsLocked || passed);
}
