import { useEffect, useState } from 'react';

export interface Remaining {
  days: number;
  hours: number;
  minutes: number;
}

/** Time left until `target`, or null once it has passed. */
export function timeUntil(target: Date, now: Date): Remaining | null {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60_000);
  return {
    days: Math.floor(totalMinutes / (24 * 60)),
    hours: Math.floor((totalMinutes % (24 * 60)) / 60),
    minutes: totalMinutes % 60,
  };
}

/** Current time, refreshed every `intervalMs`. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Date and time, e.g. "29 octobre 2026 à 19:35". */
export function formatDateTime(iso: string, locale: string | undefined): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

// setTimeout overflows past ~24.8 days: longer waits are done in steps.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/** Whether `iso` has passed; flips exactly at that moment while the component is mounted. */
export function useIsPast(iso: string | undefined): boolean {
  const target = iso ? new Date(iso).getTime() : Number.NaN;
  const [past, setPast] = useState(() => Date.now() >= target);
  useEffect(() => {
    if (Number.isNaN(target)) return;
    let id: ReturnType<typeof setTimeout>;
    const check = () => {
      const ms = target - Date.now();
      setPast(ms <= 0);
      if (ms > 0) id = setTimeout(check, Math.min(ms, MAX_TIMEOUT_MS));
    };
    check();
    return () => clearTimeout(id);
  }, [target]);
  return past;
}
