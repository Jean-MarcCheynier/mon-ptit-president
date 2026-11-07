import { z } from 'zod';

export const ballotEntryInputSchema = z.object({ isCandidate: z.boolean() });
export type BallotEntryInput = z.infer<typeof ballotEntryInputSchema>;

/** Validation needs at least this many politicians kept as candidates. */
export const MIN_CANDIDATES = 2;

export interface BallotEntryDto {
  politicianId: string;
  /** true: will be on the first-round ballot paper. */
  isCandidate: boolean;
}

/** The user's draft for the current election; no entries when there is no draft. */
export interface DraftBallotDto {
  entries: BallotEntryDto[];
}

/** An immutable, validated ballot. The latest one is the user's current bet. */
export interface ValidatedBallotDto {
  validatedAt: string;
  entries: BallotEntryDto[];
}

/** The user's current bet for the current election, if they ever validated one. */
export interface CurrentBallotDto {
  ballot: ValidatedBallotDto | null;
}

/** The phases of the game, each with its own predictions, opening and closing. */
export const PHASES = ['QUALIFIERS', 'FIRST_ROUND', 'SECOND_ROUND'] as const;
export type Phase = (typeof PHASES)[number];

/** Scores are stored in tenths of a point: 23.4 % is 234, and a round's prediction sums to 1000. */
export const SCORE_TOTAL = 1000;

export const scoreEntryInputSchema = z.object({ score: z.int().min(0).max(SCORE_TOTAL) });
export type ScoreEntryInput = z.infer<typeof scoreEntryInputSchema>;

export interface ScoreEntryDto {
  politicianId: string;
  /** Predicted score, in tenths of a point of the votes cast. */
  score: number;
}

/** The user's draft of a round's prediction; no entries when there is no draft. */
export interface ScoreDraftDto {
  entries: ScoreEntryDto[];
}

/** An immutable, validated round prediction. The latest one counts. */
export interface ValidatedScoresDto {
  validatedAt: string;
  entries: ScoreEntryDto[];
}

/** The user's current prediction of a round, if they ever validated one. */
export interface CurrentScoresDto {
  ballot: ValidatedScoresDto | null;
}
