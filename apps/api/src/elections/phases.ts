import { GAME_PHASES, type GamePhase, type PhaseState } from '@presidency-bingo/shared';

/** The election fields that schedule the phases. */
export interface PhaseSchedule {
  predictionsLockAt: Date;
  firstRoundClosesAt: Date | null;
}

export const phaseScheduleSelect = {
  predictionsLockAt: true,
  firstRoundClosesAt: true,
} as const satisfies Record<keyof PhaseSchedule, true>;

export interface PlayerPhase {
  phase: GamePhase;
  state: PhaseState;
  closesAt: Date | null;
  playable: boolean;
}

interface PhaseRule {
  /** False until the phase is built (#25, #36, #28): it lets the player through. */
  playable: boolean;
  /** Its closing; null if it never closes or while unknown. */
  closesAt: (schedule: PhaseSchedule) => Date | null;
  /** Whether it can open yet, previous phase aside. */
  scheduled: (schedule: PhaseSchedule) => boolean;
}

const always = () => true;

const RULES: Record<GamePhase, PhaseRule> = {
  PRESENTATION: { playable: false, closesAt: () => null, scheduled: always },
  QUALIFIERS: { playable: true, closesAt: (s) => s.predictionsLockAt, scheduled: always },
  WINNER: { playable: false, closesAt: (s) => s.predictionsLockAt, scheduled: always },
  FIRST_ROUND: {
    playable: true,
    closesAt: (s) => s.firstRoundClosesAt,
    scheduled: (s) => s.firstRoundClosesAt !== null,
  },
  // Opens once the first round's results are published (#28, #29).
  SECOND_ROUND: { playable: false, closesAt: () => null, scheduled: () => false },
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
    const { playable, closesAt: closing, scheduled } = RULES[phase];
    const closesAt = closing(schedule);
    const closed = isPast(closesAt, now);
    const done = playable && validated.has(phase);
    const reachable = previousCleared && scheduled(schedule);

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
