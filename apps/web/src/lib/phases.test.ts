import type { GamePhase, PhaseState, PlayerPhaseDto } from '@presidency-bingo/shared';
import { describe, expect, it } from 'vitest';
import { currentPhasePage } from './phases';

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
