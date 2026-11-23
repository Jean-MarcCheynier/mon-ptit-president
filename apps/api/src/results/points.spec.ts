import { scoreDecisions, scoreRound, scoreWinner, type Tally } from './points.js';

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

describe('scoreWinner', () => {
  const favorites = new Set(['le-pen', 'glucksmann']);

  it('brings the odds of an elected favorite', () => {
    expect(scoreWinner({ politicianId: 'glucksmann', odds: 9999 }, 'glucksmann', favorites)).toBe(
      9999,
    );
  });

  it('brings nothing when another is elected', () => {
    expect(scoreWinner({ politicianId: 'le-pen', odds: 90 }, 'glucksmann', favorites)).toBe(0);
    expect(scoreWinner({ politicianId: 'le-pen', odds: 90 }, 'outsider', favorites)).toBe(0);
  });

  it('makes "autre candidat" win when the elected is none of the favorites', () => {
    const other = { politicianId: null, odds: 1000 };
    expect(scoreWinner(other, 'outsider', favorites)).toBe(1000);
    expect(scoreWinner(other, 'le-pen', favorites)).toBe(0);
  });
});

/**
 * The first round's scoring (docs/adr/0004-les-tours-se-jouent-a-l-ecart.md), per candidate with
 * a real score, from the gap |predicted − real| in points of percentage:
 *
 *   points
 *     30 ┤━━━━╮
 *        │     ╲
 *        │      ╲            quadratic in between: 30 × ((threshold − gap) / (threshold − 0.1))²
 *        │        ╲_         so halfway is worth a quarter: precision pays, not the near miss
 *      0 ┤           ╰━━━━━━
 *        └────┬──────┬──────── gap
 *            0.1     threshold = max(10 % of the real score, 1 point)
 *
 * e.g. real 30 %: threshold 3 points, so 31.5 % (gap 1.5) is worth 30 × ((3 − 1.5) / (3 − 0.1))².
 * Real 5 %: 10 % of it is 0.5, floored to 1 point.
 *
 * Plus 50 points per right finalist: the two first of the prediction against the two first of
 * the results, whatever the order (0, 50 or 100). A tie for the predicted second place, or a 0 %
 * score, makes no finalist. Lines on candidates without a real score (not qualified, withdrawn
 * before the vote) are ignored, a qualified one without a line counts as 0 %.
 *
 * Units: predictions in tenths of a point (23.4 % → 234), real scores and gaps in hundredths
 * (23.15 % → 2315).
 */
describe('scoreRound', () => {
  const real = new Map([
    ['a', 3000],
    ['b', 2500],
    ['c', 2000],
    ['d', 500],
  ]);
  const line = (predicted: number, actual: number) => {
    const [entry] = scoreRound(new Map([['x', predicted]]), new Map([['x', actual]])).lines;
    if (!entry) throw new Error('No line scored');
    return entry;
  };

  it('gives 30 points within 0.1 point', () => {
    expect(line(300, 3000)).toMatchObject({ gap: 0, points: 30 });
    expect(line(301, 3000)).toMatchObject({ gap: 10, points: 30 });
    expect(line(299, 3010)).toMatchObject({ gap: 20 });
  });

  it('decreases quadratically down to 0 at 10 % of the real score', () => {
    // Threshold: 3 points (300 hundredths); 30 points at a gap of 10, 0 at 300.
    expect(line(330, 3000).points).toBe(0);
    expect(line(350, 3000).points).toBe(0);
    expect(line(315, 3000).points).toBeCloseTo(30 * ((300 - 150) / (300 - 10)) ** 2);
    expect(line(285, 3000).points).toBeCloseTo(30 * ((300 - 150) / (300 - 10)) ** 2);
    // Halfway between 0.1 point and the threshold (3.1 points for 31 %): a quarter of the points.
    expect(line(326, 3100)).toMatchObject({ gap: 160, points: 7.5 });
  });

  it('floors the threshold at 1 point', () => {
    // 5 %: 10 % of it would be 0.5 point; the threshold stays at 1 point.
    expect(line(60, 500).points).toBe(0);
    expect(line(55, 500).points).toBeCloseTo(30 * ((100 - 50) / (100 - 10)) ** 2);
  });

  it('adds 50 points per right finalist, whatever the order', () => {
    const score = (predicted: Record<string, number>) =>
      scoreRound(new Map(Object.entries(predicted)), real);
    expect(score({ a: 250, b: 300, c: 200, d: 50 })).toMatchObject({ finalists: 2, bonus: 100 });
    expect(score({ a: 300, b: 200, c: 250, d: 50 })).toMatchObject({ finalists: 1, bonus: 50 });
    expect(score({ a: 100, b: 100, c: 300, d: 250 })).toMatchObject({ finalists: 0, bonus: 0 });
  });

  it('picks no predicted finalist among a tie for second place, nor at 0 %', () => {
    const tie = scoreRound(new Map(Object.entries({ a: 300, b: 200, c: 200, d: 0 })), real);
    expect(tie).toMatchObject({ finalists: 1, bonus: 50 });
    const empty = scoreRound(new Map(), real);
    expect(empty).toMatchObject({ finalists: 0, bonus: 0 });
  });

  it('scores every candidate with a real score, a missing line counting as 0 %', () => {
    const { lines: entries } = scoreRound(new Map([['a', 300]]), real);
    expect(entries.map((e) => [e.politicianId, e.predicted])).toEqual([
      ['a', 300],
      ['b', 0],
      ['c', 0],
      ['d', 0],
    ]);
  });

  it('ignores the lines on candidates without a real score, without renormalizing', () => {
    const withdrawn = scoreRound(new Map(Object.entries({ a: 250, b: 300, z: 400 })), real);
    expect(withdrawn.lines.map((e) => e.politicianId)).toEqual(['a', 'b', 'c', 'd']);
    // z had the highest prediction: a and b are still the predicted finalists.
    expect(withdrawn.finalists).toBe(2);
    expect(withdrawn.lines.find((e) => e.politicianId === 'a')?.predicted).toBe(250);
  });

  it('sums the exact points and the bonus', () => {
    const {
      lines: entries,
      bonus,
      points,
    } = scoreRound(new Map(Object.entries({ a: 300, b: 250, c: 200, d: 50 })), real);
    expect(entries.every((e) => e.points === 30)).toBe(true);
    expect(bonus).toBe(100);
    expect(points).toBe(220);
  });
});
