import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDeadline, useIsPast } from './time';

describe('formatDeadline', () => {
  it('gives the day and the hour, without the year', () => {
    const at = '2099-03-12T19:00:00Z';
    expect(formatDeadline(at, 'fr', 'Europe/Paris')).toEqual({ date: '12 mars', time: '20 h' });
    expect(formatDeadline(at, 'en', 'Europe/Paris')).toEqual({ date: 'March 12', time: '8 PM' });
  });

  it('adds the minutes when the time is not round', () => {
    const at = '2099-04-16T21:59:59Z';
    expect(formatDeadline(at, 'fr', 'Europe/Paris')).toEqual({ date: '16 avril', time: '23 h 59' });
    // ICU may space "PM" with a narrow no-break space.
    expect(formatDeadline(at, 'en', 'Europe/Paris')).toEqual({
      date: 'April 16',
      time: expect.stringMatching(/^11:59\sPM$/),
    });
  });
});

describe('useIsPast', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is true for a past date and false without one', () => {
    const past = inMs(-1);
    expect(renderHook(() => useIsPast(past)).result.current).toBe(true);
    expect(renderHook(() => useIsPast(undefined)).result.current).toBe(false);
  });

  it('flips exactly when the date passes', () => {
    const target = inMs(5000);
    const { result } = renderHook(() => useIsPast(target));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(4999));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it('waits past the setTimeout limit in steps', () => {
    const target = inMs(40 * DAY);
    const { result } = renderHook(() => useIsPast(target));
    act(() => vi.advanceTimersByTime(39 * DAY));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(DAY));
    expect(result.current).toBe(true);
  });
});
