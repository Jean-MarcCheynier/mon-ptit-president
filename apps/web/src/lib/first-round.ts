import {
  type CurrentScoresDto,
  ErrorCode,
  SCORE_TOTAL,
  type ScoreDraftDto,
  type ScoreEntryDto,
  type ValidatedScoresDto,
} from '@presidency-bingo/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, api } from './api';

const BASE = '/elections/current/first-round';
const DRAFT = `${BASE}/draft`;
const entryPath = (politicianId: string) => `${DRAFT}/entries/${politicianId}`;

const noElection = (error: unknown) =>
  error instanceof ApiRequestError && error.code === ErrorCode.NO_CURRENT_ELECTION;

/** The user's draft of the first-round prediction; empty when there is none. */
export const firstRoundDraftQuery = queryOptions({
  queryKey: ['elections', 'current', 'first-round', 'draft'],
  queryFn: async (): Promise<ScoreDraftDto> => {
    try {
      return await api<ScoreDraftDto>(DRAFT);
    } catch (error) {
      if (noElection(error)) return { entries: [] };
      throw error;
    }
  },
});

/** The user's validated first-round prediction; null if they never validated one. */
export const firstRoundBallotQuery = queryOptions({
  queryKey: ['elections', 'current', 'first-round', 'ballot'],
  queryFn: async (): Promise<ValidatedScoresDto | null> => {
    try {
      return (await api<CurrentScoresDto>(`${BASE}/ballot`)).ballot;
    } catch (error) {
      if (noElection(error)) return null;
      throw error;
    }
  },
});

const setDraft =
  (entries: (current: ScoreEntryDto[]) => ScoreEntryDto[]) => (draft?: ScoreDraftDto) =>
    draft && { entries: entries(draft.entries) };

/** Opens a draft pre-filled from the validated prediction (or returns the existing one). */
export function useStartFirstRoundDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<ScoreDraftDto>(DRAFT, { method: 'POST' }),
    onSuccess: (draft) => queryClient.setQueryData(firstRoundDraftQuery.queryKey, draft),
  });
}

/** Saves one score; the draft is created by the first one. */
export function useSetScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ politicianId, score }: ScoreEntryDto) =>
      api<ScoreEntryDto>(entryPath(politicianId), { method: 'PUT', body: { score } }),
    onSuccess: (entry) =>
      queryClient.setQueryData(
        firstRoundDraftQuery.queryKey,
        setDraft((entries) => [
          ...entries.filter((e) => e.politicianId !== entry.politicianId),
          entry,
        ]),
      ),
  });
}

/** Freezes the draft into the prediction that counts. */
export function useValidateScores() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<ValidatedScoresDto>(`${DRAFT}/validate`, { method: 'POST' }),
    onSuccess: (ballot) => {
      queryClient.setQueryData(firstRoundBallotQuery.queryKey, ballot);
      queryClient.setQueryData(firstRoundDraftQuery.queryKey, { entries: [] });
    },
  });
}

const SCORE_PATTERN = /^(\d{1,3})?(?:[.,](\d))?$/;

/**
 * A typed percentage in tenths of a point ("23,4" → 234): null when empty, undefined when it
 * isn't a percentage between 0 and 100 with at most one decimal.
 */
export function parseScore(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const match = SCORE_PATTERN.exec(trimmed);
  if (!match || (match[1] === undefined && match[2] === undefined)) return undefined;
  const tenths = Number(match[1] ?? 0) * 10 + Number(match[2] ?? 0);
  return tenths <= SCORE_TOTAL ? tenths : undefined;
}

/** Slider step: one tenth of a point. */
export const SCORE_STEP = 1;

/** Tenths of a point as a plain number for a field, in the locale ("23,4"). */
export const toScoreInput = (tenths: number, locale: string | undefined) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 1, useGrouping: false }).format(
    tenths / 10,
  );

/** Tenths of a point as a percentage with one decimal, e.g. "23,4 %". */
export function formatScore(tenths: number, locale: string | undefined): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(tenths / SCORE_TOTAL);
}

/**
 * Tenths of a point left to share out between the qualified candidates (a candidate without a
 * score counts as 0); negative when the scores exceed 100 %. Only a guide: the sum is free.
 */
export function remainingScore(
  qualifiedIds: string[],
  scores: Readonly<Record<string, number>>,
): number {
  return SCORE_TOTAL - qualifiedIds.reduce((sum, id) => sum + (scores[id] ?? 0), 0);
}
