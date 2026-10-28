import { type CurrentElectionDto, ErrorCode } from '@presidency-bingo/shared';
import { queryOptions } from '@tanstack/react-query';
import { ApiRequestError, api } from './api';

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
