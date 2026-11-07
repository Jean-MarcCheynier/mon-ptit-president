import { scoreDecisions, type Tally } from './points.js';

const tallies = (entries: Record<string, Tally>) => new Map(Object.entries(entries));
const one = (isCandidate: boolean, tally: Tally, qualified: boolean) => {
  const [scored] = scoreDecisions(
    [{ politicianId: 'x', isCandidate }],
    tallies({ x: tally }),
    new Set(qualified ? ['x'] : []),
  );
  if (!scored) throw new Error('No decision scored');
  return scored;
};

describe('scoreDecisions', () => {
  it('gives 1 point for a unanimous right decision', () => {
    expect(one(true, { qualified: 10, notQualified: 0 }, true)).toMatchObject({
      correct: true,
      agreement: 1,
      points: 1,
    });
  });

  it('gives 100 points when alone against everyone', () => {
    expect(one(false, { qualified: 9, notQualified: 1 }, false)).toMatchObject({
      correct: true,
      agreement: 0,
      points: 100,
    });
  });

  it('gives 10 points when half of the others chose otherwise', () => {
    const { points } = one(true, { qualified: 3, notQualified: 2 }, true);
    expect(points).toBeCloseTo(10);
  });

  it('excludes the player from the share', () => {
    // 2 others: 1 agrees, 1 doesn't.
    expect(one(true, { qualified: 2, notQualified: 1 }, true).agreement).toBe(0.5);
  });

  it('gives 0 for a wrong decision, whatever the rarity', () => {
    expect(one(true, { qualified: 1, notQualified: 9 }, false)).toMatchObject({
      correct: false,
      points: 0,
    });
  });

  it('gives 1 point when nobody else decided', () => {
    expect(one(true, { qualified: 1, notQualified: 0 }, true)).toMatchObject({
      agreement: null,
      points: 1,
    });
  });

  it('counts "recalé" right for a candidate missing from the official list', () => {
    expect(one(false, { qualified: 0, notQualified: 1 }, false).correct).toBe(true);
  });
});
