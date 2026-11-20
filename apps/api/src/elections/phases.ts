import { GAME_PHASES, type GamePhase, type PhaseState } from '@presidency-bingo/shared';

/** What schedules the phases: the election's closings, and whether its winner's phase is set up. */
export interface PhaseSchedule {
  predictionsLockAt: Date;
  firstRoundClosesAt: Date | null;
  /** The election lists favorites for the winner's prediction (docs/adr/0003). */
  hasFavorites: boolean;
}

/** The election fields to read for `toPhaseSchedule`. */
export const phaseScheduleSelect = {
  predictionsLockAt: true,
  firstRoundClosesAt: true,
  _count: { select: { favorites: true } },
} as const;

export const toPhaseSchedule = ({
  predictionsLockAt,
  firstRoundClosesAt,
  _count,
}: {
  predictionsLockAt: Date;
  firstRoundClosesAt: Date | null;
  _count: { favorites: number };
}): PhaseSchedule => ({
  predictionsLockAt,
  firstRoundClosesAt,
  hasFavorites: _count.favorites > 0,
});

export interface PlayerPhase {
  phase: GamePhase;
  state: PhaseState;
  closesAt: Date | null;
  playable: boolean;
}

interface PhaseRule {
  /** False until the phase is built (#28) or set up for the election: it lets the player through. */
  playable: (schedule: PhaseSchedule) => boolean;
  /** Its closing; null if it never closes or while unknown. */
  closesAt: (schedule: PhaseSchedule) => Date | null;
  /** Whether it can open yet, previous phase aside. */
  scheduled: (schedule: PhaseSchedule) => boolean;
}

const always = () => true;
const never = () => false;

const RULES: Record<GamePhase, PhaseRule> = {
  // Never closes: it can be read again at any time.
  PRESENTATION: { playable: always, closesAt: () => null, scheduled: always },
  QUALIFIERS: { playable: always, closesAt: (s) => s.predictionsLockAt, scheduled: always },
  WINNER: {
    playable: (s) => s.hasFavorites,
    closesAt: (s) => s.predictionsLockAt,
    scheduled: always,
  },
  FIRST_ROUND: {
    playable: always,
    closesAt: (s) => s.firstRoundClosesAt,
    scheduled: (s) => s.firstRoundClosesAt !== null,
  },
  // Opens once the first round's results are published (#28, #29).
  SECOND_ROUND: { playable: never, closesAt: () => null, scheduled: never },
};

/**
 * Where a player stands in each phase, in order (docs/adr/0002). A phase opens once the previous
 * one is cleared: validated, or closed (skipped). Editing a validated phase again keeps it
 * cleared. A phase that isn't playable yet is cleared as soon as the one before it is.
 *
 * @param validated the phases the player validated a prediction for
 */
export function playerPhases(
  schedule: PhaseSchedule,
  validated: ReadonlySet<GamePhase>,
  now = new Date(),
): PlayerPhase[] {
  let previousCleared = true;
  return GAME_PHASES.map((phase) => {
    const rule = RULES[phase];
    const playable = rule.playable(schedule);
    const closesAt = rule.closesAt(schedule);
    const closed = isPast(closesAt, now);
    const done = playable && validated.has(phase);
    const reachable = previousCleared && rule.scheduled(schedule);

    const state: PhaseState = closed
      ? done
        ? 'CLOSED'
        : 'SKIPPED'
      : !playable || !reachable
        ? 'UPCOMING'
        : done
          ? 'DONE'
          : 'TODO';

    previousCleared = done || closed || (!playable && previousCleared);
    return { phase, state, closesAt, playable };
  });
}

export const isPast = (date: Date | null, now = new Date()) => date !== null && now >= date;

/**
 * Whether the player cleared the presentation: any version of it seen, even an older one (a new
 * version is only proposed), or a prediction validated before the presentation existed.
 */
export const presentationCleared = (onboardingVersionSeen: number, validatedAny: boolean) =>
  onboardingVersionSeen > 0 || validatedAny;
