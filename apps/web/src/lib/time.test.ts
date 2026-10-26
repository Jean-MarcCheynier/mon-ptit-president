import { describe, expect, it } from 'vitest';
import { timeUntil } from './time';

describe('timeUntil', () => {
  const now = new Date('2026-10-26T12:00:00Z');

  it('splits the remaining time into days, hours and minutes', () => {
    expect(timeUntil(new Date('2026-10-28T15:30:59Z'), now)).toEqual({
      days: 2,
      hours: 3,
      minutes: 30,
    });
  });

  it('returns null once the target has passed', () => {
    expect(timeUntil(now, now)).toBeNull();
    expect(timeUntil(new Date('2026-10-25T00:00:00Z'), now)).toBeNull();
  });
});
