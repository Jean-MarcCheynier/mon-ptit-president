import type { GamePhase, PhaseState, PlayerPhaseDto } from '@presidency-bingo/shared';
import { describe, expect, it } from 'vitest';
import { currentPhasePage, nextStepHint, phaseAction } from './phases';

const phase = (phase: GamePhase, state: PhaseState, playable = true): PlayerPhaseDto => ({
  phase,
  state,
  closesAt: null,
  playable,
});

describe('currentPhasePage', () => {
  it('leads to the page of the current step', () => {
    expect(
      currentPhasePage([
        phase('PRESENTATION', 'DONE', false),
        phase('QUALIFIERS', 'TODO'),
        phase('WINNER', 'UPCOMING'),
      ]),
    ).toBe('/predict');
    expect(
      currentPhasePage([
        phase('QUALIFIERS', 'DONE'),
        phase('WINNER', 'TODO'),
        phase('FIRST_ROUND', 'UPCOMING'),
      ]),
    ).toBe('/winner');
    expect(
      currentPhasePage([
        phase('QUALIFIERS', 'CLOSED'),
        phase('WINNER', 'SKIPPED'),
        phase('FIRST_ROUND', 'TODO'),
      ]),
    ).toBe('/first-round');
  });

  it('looks further when the current step has no page', () => {
    expect(
      currentPhasePage([
        phase('PRESENTATION', 'TODO'),
        phase('QUALIFIERS', 'DONE'),
        phase('WINNER', 'UPCOMING'),
      ]),
    ).toBe('/predict');
  });

  it('without a current step, leads to the last phase still writable', () => {
    expect(
      currentPhasePage([
        phase('QUALIFIERS', 'DONE'),
        phase('WINNER', 'DONE'),
        phase('FIRST_ROUND', 'UPCOMING'),
        phase('SECOND_ROUND', 'UPCOMING', false),
      ]),
    ).toBe('/winner');
    expect(
      currentPhasePage([
        phase('QUALIFIERS', 'CLOSED'),
        phase('WINNER', 'CLOSED'),
        phase('FIRST_ROUND', 'DONE'),
        phase('SECOND_ROUND', 'TODO', false),
      ]),
    ).toBe('/first-round');
  });

  it('when everything is closed, leads to the last closed phase with a page', () => {
    expect(
      currentPhasePage([
        phase('PRESENTATION', 'CLOSED'),
        phase('QUALIFIERS', 'CLOSED'),
        phase('WINNER', 'SKIPPED'),
        phase('FIRST_ROUND', 'CLOSED'),
        phase('SECOND_ROUND', 'CLOSED'),
      ]),
    ).toBe('/first-round');
    expect(
      currentPhasePage([
        phase('QUALIFIERS', 'CLOSED'),
        phase('WINNER', 'CLOSED'),
        phase('FIRST_ROUND', 'UPCOMING'),
      ]),
    ).toBe('/winner');
  });

  it('falls back to the qualifiers when no phase applies', () => {
    expect(currentPhasePage([])).toBe('/predict');
    expect(currentPhasePage([phase('QUALIFIERS', 'UPCOMING')])).toBe('/predict');
  });
});

describe('phaseAction', () => {
  it('offers to predict, resume or edit while the phase is writable', () => {
    expect(phaseAction('TODO')).toBe('PREDICT');
    expect(phaseAction('TODO', { draft: true })).toBe('RESUME');
    expect(phaseAction('DONE')).toBe('EDIT');
    expect(phaseAction('DONE', { draft: true })).toBe('RESUME');
  });

  it('offers to view a closed phase, and nothing for a skipped or upcoming one', () => {
    expect(phaseAction('CLOSED')).toBe('VIEW');
    expect(phaseAction('SKIPPED')).toBeNull();
    expect(phaseAction('UPCOMING')).toBeNull();
  });

  it('offers the results once published', () => {
    expect(phaseAction('CLOSED', { results: true })).toBe('RESULTS');
  });
});

describe('nextStepHint', () => {
  const now = new Date('2027-01-15T12:00:00Z');
  const election = {
    officialListPublishedAt: '2027-03-10T18:00:00Z',
    firstRoundAt: '2027-04-10T06:00:00Z',
  };
  const journey = (states: [PhaseState, PhaseState, PhaseState, PhaseState], winner = true) => [
    phase('PRESENTATION', 'DONE'),
    phase('QUALIFIERS', states[0]),
    phase('WINNER', states[1], winner),
    phase('FIRST_ROUND', states[2]),
    phase('SECOND_ROUND', states[3], false),
  ];

  it('points to the qualifiers to do', () => {
    expect(
      nextStepHint(journey(['TODO', 'UPCOMING', 'UPCOMING', 'UPCOMING']), election, now),
    ).toEqual({ kind: 'TODO', phase: 'QUALIFIERS' });
  });

  it('points to the winner to do', () => {
    expect(nextStepHint(journey(['DONE', 'TODO', 'UPCOMING', 'UPCOMING']), election, now)).toEqual({
      kind: 'TODO',
      phase: 'WINNER',
    });
  });

  it('points to the first round to do', () => {
    expect(nextStepHint(journey(['CLOSED', 'SKIPPED', 'TODO', 'UPCOMING']), election, now)).toEqual(
      { kind: 'TODO', phase: 'FIRST_ROUND' },
    );
  });

  it('points to the second round to do', () => {
    const phases = journey(['CLOSED', 'CLOSED', 'CLOSED', 'TODO']);
    phases[4] = phase('SECOND_ROUND', 'TODO');
    expect(nextStepHint(phases, election, now)).toEqual({ kind: 'TODO', phase: 'SECOND_ROUND' });
  });

  it('ignores the presentation, even to do', () => {
    const phases = journey(['TODO', 'UPCOMING', 'UPCOMING', 'UPCOMING']);
    phases[0] = phase('PRESENTATION', 'TODO');
    expect(nextStepHint(phases, election, now)).toEqual({ kind: 'TODO', phase: 'QUALIFIERS' });
  });

  it('ignores a winner phase that is not playable', () => {
    expect(
      nextStepHint(journey(['DONE', 'UPCOMING', 'TODO', 'UPCOMING'], false), election, now),
    ).toEqual({ kind: 'TODO', phase: 'FIRST_ROUND' });
    expect(
      nextStepHint(journey(['DONE', 'UPCOMING', 'UPCOMING', 'UPCOMING'], false), election, now),
    ).toEqual({ kind: 'RENDEZVOUS', date: election.officialListPublishedAt });
  });

  it('sets the first round rendez-vous at the official list', () => {
    expect(nextStepHint(journey(['DONE', 'DONE', 'UPCOMING', 'UPCOMING']), election, now)).toEqual({
      kind: 'RENDEZVOUS',
      date: election.officialListPublishedAt,
    });
  });

  it('sets the second round rendez-vous at the first round', () => {
    expect(nextStepHint(journey(['CLOSED', 'CLOSED', 'DONE', 'UPCOMING']), election, now)).toEqual({
      kind: 'RENDEZVOUS',
      date: election.firstRoundAt,
    });
  });

  it('gives no date to a rendez-vous while unknown', () => {
    expect(
      nextStepHint(
        journey(['DONE', 'DONE', 'UPCOMING', 'UPCOMING']),
        { ...election, officialListPublishedAt: null },
        now,
      ),
    ).toEqual({ kind: 'RENDEZVOUS', date: null });
  });

  it('gives no date to a rendez-vous already past', () => {
    expect(
      nextStepHint(
        journey(['CLOSED', 'CLOSED', 'DONE', 'UPCOMING']),
        election,
        new Date('2027-04-11T00:00:00Z'),
      ),
    ).toEqual({ kind: 'RENDEZVOUS', date: null });
    expect(
      nextStepHint(
        journey(['DONE', 'DONE', 'UPCOMING', 'UPCOMING']),
        election,
        new Date(election.officialListPublishedAt),
      ),
    ).toEqual({ kind: 'RENDEZVOUS', date: null });
  });

  it('says nothing once no phase is upcoming', () => {
    const phases = journey(['CLOSED', 'CLOSED', 'CLOSED', 'SKIPPED']);
    expect(nextStepHint(phases, election, now)).toBeNull();
    expect(nextStepHint([], election, now)).toBeNull();
  });
});
