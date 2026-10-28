import { describe, expect, it } from 'vitest';
import { stableShuffle } from './shuffle';

const ids = Array.from({ length: 40 }, (_, i) => `politician-${i}`);
const shuffle = (items: string[], seed: string) => stableShuffle(items, (id) => id, seed);

describe('stableShuffle', () => {
  it('returns the same order for the same seed', () => {
    expect(shuffle(ids, 'user-a')).toEqual(shuffle(ids, 'user-a'));
  });

  it('returns a different order for another seed', () => {
    expect(shuffle(ids, 'user-a')).not.toEqual(shuffle(ids, 'user-b'));
  });

  it('actually shuffles', () => {
    expect(shuffle(ids, 'user-a')).not.toEqual(ids);
  });

  it('keeps every item exactly once', () => {
    expect(shuffle(ids, 'user-a').sort()).toEqual([...ids].sort());
  });

  it('does not depend on the input order', () => {
    expect(shuffle([...ids].reverse(), 'user-a')).toEqual(shuffle(ids, 'user-a'));
  });

  it('keeps the relative order of existing items when one is added', () => {
    const before = shuffle(ids, 'user-a');
    const after = shuffle([...ids, 'newcomer'], 'user-a');
    expect(after.filter((id) => id !== 'newcomer')).toEqual(before);
  });
});
