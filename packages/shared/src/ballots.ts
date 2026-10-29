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
