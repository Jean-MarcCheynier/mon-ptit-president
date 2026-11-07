import type { Phase, PhaseStatus } from '@presidency-bingo/shared';

export interface PhaseWindow {
  opensAt: Date | null;
  closesAt: Date | null;
}

/** The election fields that schedule the phases. */
export interface PhaseSchedule {
  createdAt: Date;
  predictionsLockAt: Date;
  officialListPublishedAt: Date | null;
  firstRoundClosesAt: Date | null;
}

export const phaseScheduleSelect = {
  createdAt: true,
  predictionsLockAt: true,
  officialListPublishedAt: true,
  firstRoundClosesAt: true,
} as const satisfies Record<keyof PhaseSchedule, true>;

/**
 * When each phase opens and closes. Qualifiers: from the creation of the election until
 * `predictionsLockAt`; first round: from the creation of the election too (players predict on
 * their kept candidates until the official list is published) until `firstRoundClosesAt`.
 * The second round isn't scheduled yet (#28).
 */
export function phaseWindow(election: PhaseSchedule, phase: Phase): PhaseWindow {
  switch (phase) {
    case 'QUALIFIERS':
      return { opensAt: election.createdAt, closesAt: election.predictionsLockAt };
    case 'FIRST_ROUND':
      return { opensAt: election.createdAt, closesAt: election.firstRoundClosesAt };
    default:
      return { opensAt: null, closesAt: null };
  }
}

/** Open only between two known dates; a phase missing one stays UPCOMING until it closes. */
export function phaseStatus({ opensAt, closesAt }: PhaseWindow, now = new Date()): PhaseStatus {
  if (isPast(closesAt, now)) return 'CLOSED';
  return closesAt !== null && isPast(opensAt, now) ? 'OPEN' : 'UPCOMING';
}

export const isPast = (date: Date | null, now = new Date()) => date !== null && now >= date;
