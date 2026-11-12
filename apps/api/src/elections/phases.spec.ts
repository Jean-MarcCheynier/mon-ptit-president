import type { GamePhase, PhaseState } from '@presidency-bingo/shared';
import { type PhaseSchedule, playerPhases } from './phases.js';

const at = (iso: string) => new Date(iso);

const election: PhaseSchedule = {
  predictionsLockAt: at('2027-03-12T17:00:00Z'),
  firstRoundClosesAt: at('2027-04-16T21:59:59Z'),
};

const BEFORE_LOCK = '2026-11-10T00:00:00Z';
const AFTER_LOCK = '2027-03-20T00:00:00Z';
const AFTER_FIRST_ROUND = '2027-04-17T00:00:00Z';

/** Each phase's state, for a player who validated `validated`. */
const states = (
  now: string,
  validated: GamePhase[] = [],
  schedule: PhaseSchedule = election,
): Record<GamePhase, PhaseState> =>
  Object.fromEntries(
    playerPhases(schedule, new Set(validated), at(now)).map((p) => [p.phase, p.state]),
  ) as Record<GamePhase, PhaseState>;

describe('player phases', () => {
  it('lists the five phases in order, with their closing', () => {
    const phases = playerPhases(election, new Set(), at(BEFORE_LOCK));
    expect(phases.map((p) => [p.phase, p.closesAt])).toEqual([
      ['PRESENTATION', null],
      ['QUALIFIERS', election.predictionsLockAt],
      ['WINNER', election.predictionsLockAt],
      ['FIRST_ROUND', election.firstRoundClosesAt],
      ['SECOND_ROUND', null],
    ]);
  });

  it('starts a new player at the qualifiers, the phases not built yet letting them through', () => {
    expect(states(BEFORE_LOCK)).toEqual({
      PRESENTATION: 'UPCOMING',
      QUALIFIERS: 'TODO',
      WINNER: 'UPCOMING',
      FIRST_ROUND: 'UPCOMING',
      SECOND_ROUND: 'UPCOMING',
    });
    const playable = playerPhases(election, new Set(), at(BEFORE_LOCK)).map((p) => p.playable);
    expect(playable).toEqual([false, true, false, true, false]);
  });

  it('opens the first round once the qualifiers are validated (the winner is not built yet)', () => {
    expect(states(BEFORE_LOCK, ['QUALIFIERS'])).toMatchObject({
      QUALIFIERS: 'DONE',
      FIRST_ROUND: 'TODO',
    });
    expect(states(BEFORE_LOCK, ['QUALIFIERS', 'FIRST_ROUND'])).toMatchObject({
      QUALIFIERS: 'DONE',
      FIRST_ROUND: 'DONE',
    });
  });

  it('skips a phase closed without a validated prediction, which opens the next one', () => {
    expect(states(AFTER_LOCK)).toMatchObject({
      QUALIFIERS: 'SKIPPED',
      WINNER: 'SKIPPED',
      FIRST_ROUND: 'TODO',
    });
  });

  it('closes a validated phase, read-only', () => {
    expect(states(AFTER_LOCK, ['QUALIFIERS'])).toMatchObject({
      QUALIFIERS: 'CLOSED',
      FIRST_ROUND: 'TODO',
    });
    expect(states(AFTER_FIRST_ROUND, ['QUALIFIERS', 'FIRST_ROUND'])).toMatchObject({
      QUALIFIERS: 'CLOSED',
      FIRST_ROUND: 'CLOSED',
    });
    expect(states(AFTER_FIRST_ROUND, ['QUALIFIERS'])).toMatchObject({ FIRST_ROUND: 'SKIPPED' });
  });

  it('closes at the exact closing instant', () => {
    expect(states('2027-03-12T16:59:59.999Z')).toMatchObject({ QUALIFIERS: 'TODO' });
    expect(states('2027-03-12T17:00:00Z')).toMatchObject({ QUALIFIERS: 'SKIPPED' });
  });

  it('keeps the first round upcoming while its closing is unknown', () => {
    const unscheduled = { ...election, firstRoundClosesAt: null };
    expect(states(AFTER_LOCK, ['QUALIFIERS'], unscheduled)).toMatchObject({
      FIRST_ROUND: 'UPCOMING',
    });
  });

  it('does not open the second round yet (not scheduled, #28)', () => {
    expect(states(AFTER_FIRST_ROUND, ['QUALIFIERS', 'FIRST_ROUND'])).toMatchObject({
      SECOND_ROUND: 'UPCOMING',
    });
  });
});
