import { describe, expect, it } from 'vitest';
import { formatScore, parseScore, remainingScore } from './first-round';

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

describe('remainingScore', () => {
  const ids = ['a', 'b', 'c'];

  it('counts what remains to share out, a missing score counting as 0', () => {
    expect(remainingScore(ids, { a: 500, b: 300 })).toBe(200);
    expect(remainingScore(ids, {})).toBe(1000);
  });

  it('goes negative past 100 % and ignores candidates out of the list', () => {
    expect(remainingScore(ids, { a: 500, b: 300, c: 300 })).toBe(-100);
    expect(remainingScore(ids, { a: 500, b: 300, c: 200, z: 50 })).toBe(0);
  });
});
