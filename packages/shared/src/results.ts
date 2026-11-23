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

/** Real scores are in hundredths of a point: 23.15 % is 2315. */
export const RESULT_SCORE_TOTAL = 10_000;

/** One candidate of the first round: the player's score against the real one. */
export interface RoundResultEntryDto {
  politicianId: string;
  name: string;
  photoUrl: string | null;
  /** Predicted score, in tenths of a point; 0 when the prediction didn't score them. */
  predicted: number;
  /** Real score, in hundredths of a point (see RESULT_SCORE_TOTAL). */
  actual: number;
  /** Gap between both, in hundredths of a point. */
  gap: number;
  /** Points of this score, rounded to a tenth. */
  points: number;
  /** Among the two first of the prediction. */
  predictedFinalist: boolean;
  /** Among the two first of the results. */
  finalist: boolean;
}

/** The player's first-round prediction against the results. */
export interface RoundResultDto {
  /** Total points, the bonus included, rounded from the exact sum. */
  points: number;
  /** Right finalists, whatever the order: 0, 1 or 2. */
  finalists: number;
  /** Points of the right finalists. */
  bonus: number;
  /** Every candidate with a real score, by real score descending. */
  entries: RoundResultEntryDto[];
}

export interface RoundResultsDto {
  /** false until the round's results are published: nothing else is exposed. */
  published: boolean;
  /** The official results (Constitutional Council) rather than the provisional ones. */
  final: boolean;
  /** null before publication, or when the player never validated a prediction. */
  result: RoundResultDto | null;
}
