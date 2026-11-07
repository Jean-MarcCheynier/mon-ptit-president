import { ErrorCode, type ResultsDto } from '@presidency-bingo/shared';
import { queryOptions } from '@tanstack/react-query';
import { ApiRequestError, api } from './api';

/** The player's result against the official list; unpublished while there is none. */
export const resultsQuery = queryOptions({
  queryKey: ['elections', 'current', 'results'],
  queryFn: async (): Promise<ResultsDto> => {
    try {
      return await api<ResultsDto>('/elections/current/results');
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === ErrorCode.NO_CURRENT_ELECTION) {
        return { published: false, result: null };
      }
      throw error;
    }
  },
});
