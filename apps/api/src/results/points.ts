/** How many players decided "qualifié" / "recalé" for a candidate (latest validated bets). */
export interface Tally {
  qualified: number;
  notQualified: number;
}

export interface Decision {
  politicianId: string;
  isCandidate: boolean;
}

export interface Score {
  correct: boolean;
  /** Share of the other players who made the same decision; null when nobody else decided. */
  agreement: number | null;
  /** Exact points: 100^p if right (p = share of the others who chose otherwise), 0 if wrong. */
  points: number;
}

/**
 * Scores a bet against the official list (docs/adr/0001-points-selon-la-rarete.md).
 * `tallies` count every player, the scored one included: their own decision is taken out.
 */
export function scoreDecisions<D extends Decision>(
  decisions: D[],
  tallies: ReadonlyMap<string, Tally>,
  qualified: ReadonlySet<string>,
): (D & Score)[] {
  return decisions.map((decision) => {
    const correct = decision.isCandidate === qualified.has(decision.politicianId);
    const tally = tallies.get(decision.politicianId) ?? { qualified: 0, notQualified: 0 };
    const same = Math.max((decision.isCandidate ? tally.qualified : tally.notQualified) - 1, 0);
    const others = same + (decision.isCandidate ? tally.notQualified : tally.qualified);
    const agreement = others > 0 ? same / others : null;
    // Nobody else decided: no rarity to reward, worth 1 like a unanimous decision.
    const p = agreement === null ? 0 : 1 - agreement;
    return { ...decision, correct, agreement, points: correct ? 100 ** p : 0 };
  });
}

/** A winner's prediction: a favorite, or "autre candidat" when `politicianId` is null. */
export interface WinnerChoice {
  politicianId: string | null;
  odds: number;
}

/**
 * Scores a winner's prediction (docs/adr/0003-le-vainqueur-se-joue-a-cotes-fixes.md): the odds of
 * the choice if elected, else 0. "Autre candidat" wins when the elected is none of the favorites.
 *
 * @param favorites the politicians of the favorites ("autre candidat" aside)
 */
export function scoreWinner(
  choice: WinnerChoice,
  elected: string,
  favorites: ReadonlySet<string>,
): number {
  const right =
    choice.politicianId === null ? !favorites.has(elected) : choice.politicianId === elected;
  return right ? choice.odds : 0;
}

/**
 * The first round's scoring (issue #27): to recalibrate before the phase opens, from the points
 * the qualified candidates' scores would give. Gaps are in hundredths of a point.
 */
export const ROUND_SCORING = {
  /** Points of a score whose gap is at most `exactGap`; quadratic decrease down to `zeroGap`. */
  maxPoints: 30,
  exactGap: 10,
  /** The gap worth 0 points: this share of the real score, but at least `zeroGapFloor`. */
  zeroGapShare: 0.1,
  zeroGapFloor: 100,
  /** Points per right finalist, whatever the order. */
  finalistBonus: 50,
} as const;

export interface RoundLine {
  politicianId: string;
  /** Predicted score, in tenths of a point; 0 when the prediction has no line on them. */
  predicted: number;
  /** Real score, in hundredths of a point. */
  actual: number;
  /** |predicted − actual|, in hundredths of a point. */
  gap: number;
  /** Exact points of the score. */
  points: number;
  /** Among the two first of the prediction. */
  predictedFinalist: boolean;
  /** Among the two first of the results. */
  finalist: boolean;
}

export interface RoundScore {
  /** One line per candidate with a real score, by real score descending. */
  lines: RoundLine[];
  /** Right finalists: 0, 1 or 2. */
  finalists: number;
  bonus: number;
  /** Exact total: the lines' points plus the bonus. */
  points: number;
}

/** Points of a predicted score (tenths of a point) against the real one (hundredths). */
function pointsOf(gap: number, actual: number): number {
  const { maxPoints, exactGap, zeroGapShare, zeroGapFloor } = ROUND_SCORING;
  if (gap <= exactGap) return maxPoints;
  const zeroGap = Math.max(actual * zeroGapShare, zeroGapFloor);
  if (gap >= zeroGap) return 0;
  // Concave: halfway is worth a quarter, so precision pays more than a near miss.
  return maxPoints * ((zeroGap - gap) / (zeroGap - exactGap)) ** 2;
}

/**
 * The two first: the candidates above the third score, and above 0. A tie for the second place
 * leaves it empty, rather than picking one of them.
 */
function finalistsOf(scores: ReadonlyMap<string, number>): Set<string> {
  const third = [...scores.values()].sort((a, b) => b - a)[2] ?? 0;
  return new Set([...scores].filter(([, score]) => score > third).map(([id]) => id));
}

/**
 * Scores a first-round prediction against the results. Only the candidates with a real score
 * count: lines on others (not qualified, withdrawn before the vote) are ignored, and the other
 * scores aren't renormalized.
 *
 * @param predicted scores in tenths of a point, by politician
 * @param actual real scores in hundredths of a point, by politician
 */
export function scoreRound(
  predicted: ReadonlyMap<string, number>,
  actual: ReadonlyMap<string, number>,
): RoundScore {
  const kept = new Map([...actual.keys()].map((id) => [id, predicted.get(id) ?? 0]));
  const predictedFinalists = finalistsOf(kept);
  const realFinalists = finalistsOf(actual);

  const lines = [...actual]
    .sort(([, a], [, b]) => b - a)
    .map(([politicianId, real]): RoundLine => {
      const prediction = kept.get(politicianId) ?? 0;
      const gap = Math.abs(prediction * 10 - real);
      return {
        politicianId,
        predicted: prediction,
        actual: real,
        gap,
        points: pointsOf(gap, real),
        predictedFinalist: predictedFinalists.has(politicianId),
        finalist: realFinalists.has(politicianId),
      };
    });
  const finalists = lines.filter((l) => l.predictedFinalist && l.finalist).length;
  const bonus = finalists * ROUND_SCORING.finalistBonus;
  return {
    lines,
    finalists,
    bonus,
    points: lines.reduce((sum, l) => sum + l.points, bonus),
  };
}
