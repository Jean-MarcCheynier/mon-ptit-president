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
