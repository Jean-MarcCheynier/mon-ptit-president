import {
  type CurrentWinnerDto,
  ErrorCode,
  type FavoriteDto,
  type FavoritesDto,
  type ValidatedWinnerDto,
  type WinnerDraftDto,
} from '@presidency-bingo/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, api } from './api';
import { phasesQuery } from './phases';

const BASE = '/elections/current/winner';
const DRAFT = `${BASE}/draft`;

const noElection = (error: unknown) =>
  error instanceof ApiRequestError && error.code === ErrorCode.NO_CURRENT_ELECTION;

/** The favorites and their odds, in display order ("autre candidat" has no politician). */
export const favoritesQuery = queryOptions({
  queryKey: ['elections', 'current', 'winner', 'favorites'],
  queryFn: async (): Promise<FavoriteDto[]> => {
    try {
      return (await api<FavoritesDto>(`${BASE}/favorites`)).favorites;
    } catch (error) {
      if (noElection(error)) return [];
      throw error;
    }
  },
});

/** The choice of the user's draft; null without a draft or before any choice. */
export const winnerDraftQuery = queryOptions({
  queryKey: ['elections', 'current', 'winner', 'draft'],
  queryFn: async (): Promise<string | null> => {
    try {
      return (await api<WinnerDraftDto>(DRAFT)).favoriteId;
    } catch (error) {
      if (noElection(error)) return null;
      throw error;
    }
  },
});

/** The user's validated winner's prediction, with its points once the president is elected. */
export const winnerBallotQuery = queryOptions({
  queryKey: ['elections', 'current', 'winner', 'ballot'],
  queryFn: async (): Promise<CurrentWinnerDto> => {
    try {
      return await api<CurrentWinnerDto>(`${BASE}/ballot`);
    } catch (error) {
      if (noElection(error)) return { ballot: null, points: null };
      throw error;
    }
  },
});

/** Records the choice in the draft, created by the first one. */
export function useChooseWinner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (favoriteId: string) =>
      api<WinnerDraftDto>(DRAFT, { method: 'PUT', body: { favoriteId } }),
    onSuccess: ({ favoriteId }) => queryClient.setQueryData(winnerDraftQuery.queryKey, favoriteId),
  });
}

/** Freezes the draft into the prediction that counts. */
export function useValidateWinner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<ValidatedWinnerDto>(`${DRAFT}/validate`, { method: 'POST' }),
    onSuccess: (ballot) => {
      queryClient.setQueryData(winnerBallotQuery.queryKey, { ballot, points: null });
      queryClient.setQueryData(winnerDraftQuery.queryKey, null);
      void queryClient.invalidateQueries({ queryKey: phasesQuery.queryKey });
    },
  });
}
