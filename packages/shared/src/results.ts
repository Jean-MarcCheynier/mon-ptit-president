/** One decision of the bet, compared with the official list. */
export interface ResultEntryDto {
  politicianId: string;
  name: string;
  photoUrl: string | null;
  /** The player's decision: true for "qualifié". */
  isCandidate: boolean;
  /** Reality: on the official list. Withdrawn candidates are not. */
  qualified: boolean;
  /** Share (0–1) of the other players who made the same decision; null when nobody else decided. */
  agreement: number | null;
  /** Points of this decision, rounded; 0 when wrong. */
  points: number;
}

/** The player's result: their latest validated bet against the official list. */
export interface ResultDto {
  /** Decisions that were right (X). */
  correct: number;
  /** Decisions of the bet (N); candidates never decided don't count. */
  decisions: number;
  /** Total points, rounded from the exact sum. */
  points: number;
  entries: ResultEntryDto[];
}

export interface ResultsDto {
  /** false until the official list is published: nothing else is exposed. */
  published: boolean;
  /** null before publication, or when the player never validated a bet. */
  result: ResultDto | null;
}
