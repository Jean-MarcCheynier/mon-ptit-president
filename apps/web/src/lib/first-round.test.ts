import { describe, expect, it } from 'vitest';
import { formatScore, parseScore, scoresState } from './first-round';

describe('parseScore', () => {
  it('reads a percentage with at most one decimal into tenths of a point', () => {
    expect(parseScore('23.4')).toBe(234);
    expect(parseScore('23,4')).toBe(234);
    expect(parseScore(' 7 ')).toBe(70);
    expect(parseScore('0')).toBe(0);
    expect(parseScore('100')).toBe(1000);
    expect(parseScore('.5')).toBe(5);
  });

  it('treats an empty field as no score', () => {
    expect(parseScore('')).toBeNull();
    expect(parseScore('  ')).toBeNull();
  });

  it('rejects anything else', () => {
    for (const text of ['23.45', '100.1', '-1', 'abc', '1e2', '12.']) {
      expect(parseScore(text), text).toBeUndefined();
    }
  });
});

describe('formatScore', () => {
  it('shows tenths as a percentage with one decimal in the locale', () => {
    expect(formatScore(234, 'fr')).toMatch(/^23,4\s%$/);
    expect(formatScore(1000, 'en')).toBe('100.0%');
    expect(formatScore(-25, 'en')).toBe('-2.5%');
  });
});

describe('scoresState', () => {
  const ids = ['a', 'b', 'c'];

  it('counts what remains to share out and blocks until every score is set', () => {
    expect(scoresState(ids, { a: 500, b: 300 })).toEqual({
      remaining: 200,
      missing: 1,
      blocker: 'BALLOT_INCOMPLETE',
    });
  });

  it('blocks when the scores do not sum to 100 %', () => {
    expect(scoresState(ids, { a: 500, b: 300, c: 300 })).toMatchObject({
      remaining: -100,
      blocker: 'SCORE_TOTAL_INVALID',
    });
  });

  it('can be validated at exactly 100 %, ignoring candidates out of the list', () => {
    expect(scoresState(ids, { a: 500, b: 300, c: 200, z: 50 })).toEqual({
      remaining: 0,
      missing: 0,
      blocker: null,
    });
  });
});
