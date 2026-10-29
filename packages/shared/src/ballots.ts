import { z } from 'zod';

export const ballotEntryInputSchema = z.object({ isCandidate: z.boolean() });
export type BallotEntryInput = z.infer<typeof ballotEntryInputSchema>;

export interface BallotEntryDto {
  politicianId: string;
  /** true: will be on the first-round ballot paper. */
  isCandidate: boolean;
}

/** The user's draft for the current election; no entries when there is no draft. */
export interface DraftBallotDto {
  entries: BallotEntryDto[];
}
