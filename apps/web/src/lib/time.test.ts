import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { timeUntil, useIsPast } from './time';

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
