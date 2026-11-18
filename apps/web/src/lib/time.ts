import { useEffect, useState } from 'react';

/** Date and time, e.g. "29 octobre 2026 à 19:35". */
export function formatDateTime(iso: string, locale: string | undefined): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/**
 * A deadline's day and time, short and without the year: "12 mars" and "20 h" (fr), "March 12"
 * and "8 PM" (en). The minutes only show when not round: "23 h 59", "11:59 PM".
 */
export function formatDeadline(
  iso: string,
  locale: string | undefined,
  timeZone?: string,
): { date: string; time: string } {
  const at = new Date(iso);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone });
  const date = format({ day: 'numeric', month: 'long' }).format(at);
  const parts = format({ hour: 'numeric', minute: '2-digit' }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  const minute = part('minute');
  if (minute === '00') return { date, time: format({ hour: 'numeric' }).format(at) };
  // French typography: "23 h 59" rather than "23:59".
  if (locale?.startsWith('fr')) return { date, time: `${part('hour')} h ${minute}` };
  return { date, time: parts.map((p) => p.value).join('') };
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
