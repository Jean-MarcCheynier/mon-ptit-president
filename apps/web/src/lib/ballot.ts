import {
  type BallotEntryDto,
  type CurrentBallotDto,
  type DraftBallotDto,
  type ElectionCandidateDto,
  ErrorCode,
  MIN_CANDIDATES,
  type ValidatedBallotDto,
} from '@presidency-bingo/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, api } from './api';

const DRAFT = '/elections/current/draft';
const BALLOT = '/elections/current/ballot';
const entryPath = (politicianId: string) => `${DRAFT}/entries/${politicianId}`;

/** The user's draft for the current election; empty when there is none. */
export const draftQuery = queryOptions({
  queryKey: ['elections', 'current', 'draft'],
  queryFn: async (): Promise<DraftBallotDto> => {
    try {
      return await api<DraftBallotDto>(DRAFT);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === ErrorCode.NO_CURRENT_ELECTION) {
        return { entries: [] };
      }
      throw error;
    }
  },
});

/** The user's current bet (latest validated ballot); null if they never validated one. */
export const currentBallotQuery = queryOptions({
  queryKey: ['elections', 'current', 'ballot'],
  queryFn: async (): Promise<ValidatedBallotDto | null> => {
    try {
      return (await api<CurrentBallotDto>(BALLOT)).ballot;
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === ErrorCode.NO_CURRENT_ELECTION) {
        return null;
      }
      throw error;
    }
  },
});

/** Opens a draft pre-filled from the current bet (or returns the existing one). */
export function useStartDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<DraftBallotDto>(DRAFT, { method: 'POST' }),
    onSuccess: (draft) => queryClient.setQueryData(draftQuery.queryKey, draft),
  });
}

/** Freezes the draft into the current bet. */
export function useValidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<ValidatedBallotDto>(`${DRAFT}/validate`, { method: 'POST' }),
    onSuccess: (ballot) => {
      queryClient.setQueryData(currentBallotQuery.queryKey, ballot);
      queryClient.setQueryData(draftQuery.queryKey, { entries: [] });
    },
  });
}

const draftMutationKey = ['draft'];

/**
 * Optimistic draft mutation. The draft is refetched once the last pending mutation settles,
 * so a fast series of swipes never flickers back, and a failed one is reconciled with the server.
 */
function useDraftMutation<V>(
  mutationFn: (variables: V) => Promise<unknown>,
  apply: (entries: BallotEntryDto[], variables: V) => BallotEntryDto[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: draftMutationKey,
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: draftQuery.queryKey });
      queryClient.setQueryData(draftQuery.queryKey, (draft) =>
        draft ? { entries: apply(draft.entries, variables) } : draft,
      );
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: draftMutationKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey: draftQuery.queryKey });
      }
    },
  });
}

export function useSetEntry() {
  return useDraftMutation(
    ({ politicianId, isCandidate }: BallotEntryDto) =>
      api<BallotEntryDto>(entryPath(politicianId), { method: 'PUT', body: { isCandidate } }),
    (entries, entry) => [...entries.filter((e) => e.politicianId !== entry.politicianId), entry],
  );
}

export function useRemoveEntry() {
  return useDraftMutation(
    (politicianId: string) => api<void>(entryPath(politicianId), { method: 'DELETE' }),
    (entries, politicianId) => entries.filter((e) => e.politicianId !== politicianId),
  );
}

export interface Deck {
  /** The next card to decide; null once every card is decided. */
  current: ElectionCandidateDto | null;
  decided: number;
  total: number;
  /** The card "Undo" takes back: the last decided one before the current card. */
  previous: ElectionCandidateDto | null;
}

/** Where the user stands in their (already shuffled) deck. */
export function deckState(deck: ElectionCandidateDto[], entries: BallotEntryDto[]): Deck {
  const decidedIds = new Set(entries.map((e) => e.politicianId));
  const isDecided = (c: ElectionCandidateDto) => decidedIds.has(c.politicianId);
  const index = deck.findIndex((c) => !isDecided(c));
  const before = index === -1 ? deck : deck.slice(0, index);
  return {
    current: deck[index] ?? null,
    decided: deck.filter(isDecided).length,
    total: deck.length,
    previous: before.findLast(isDecided) ?? null,
  };
}

export interface Review {
  kept: ElectionCandidateDto[];
  dropped: ElectionCandidateDto[];
  undecided: number;
  /** Why the draft can't be validated yet (same codes as the API); null when it can. */
  blocker: typeof ErrorCode.BALLOT_INCOMPLETE | typeof ErrorCode.TOO_FEW_CANDIDATES | null;
}

/** The draft split into kept and dropped candidates of the active pool, and whether it can be validated. */
export function reviewState(candidates: ElectionCandidateDto[], entries: BallotEntryDto[]): Review {
  const decisions = new Map(entries.map((e) => [e.politicianId, e.isCandidate]));
  const kept = candidates.filter((c) => decisions.get(c.politicianId) === true);
  const dropped = candidates.filter((c) => decisions.get(c.politicianId) === false);
  const undecided = candidates.length - kept.length - dropped.length;
  const blocker =
    undecided > 0
      ? ErrorCode.BALLOT_INCOMPLETE
      : kept.length < MIN_CANDIDATES
        ? ErrorCode.TOO_FEW_CANDIDATES
        : null;
  return { kept, dropped, undecided, blocker };
}
