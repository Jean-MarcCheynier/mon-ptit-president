import type { ElectionCandidateDto } from '@presidency-bingo/shared';
import { describe, expect, it } from 'vitest';
import { deckState } from './ballot';

const card = (politicianId: string): ElectionCandidateDto => ({
  politicianId,
  name: politicianId,
  photoUrl: null,
  photoCredit: null,
  partyLabel: 'Parti',
  tagline: 'Fonction',
  status: 'POTENTIAL',
});
const deck = ['a', 'b', 'c'].map(card);
const decided = (...ids: string[]) =>
  ids.map((politicianId) => ({ politicianId, isCandidate: true }));

describe('deckState', () => {
  it('starts on the first card with nothing to undo', () => {
    expect(deckState(deck, [])).toMatchObject({
      current: deck[0],
      decided: 0,
      total: 3,
      previous: null,
    });
  });

  it('moves to the first undecided card', () => {
    expect(deckState(deck, decided('a', 'b'))).toMatchObject({
      current: deck[2],
      decided: 2,
      previous: deck[1],
    });
  });

  it('has no current card once every card is decided', () => {
    expect(deckState(deck, decided('c', 'a', 'b'))).toMatchObject({
      current: null,
      decided: 3,
      previous: deck[2],
    });
  });

  it('ignores entries for politicians no longer in the deck', () => {
    expect(deckState(deck, decided('a', 'gone'))).toMatchObject({ current: deck[1], decided: 1 });
  });
});
