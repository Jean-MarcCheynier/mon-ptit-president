import { type ElectionCandidateDto, ErrorCode } from '@presidency-bingo/shared';
import { describe, expect, it } from 'vitest';
import { deckState, newProfiles, reviewState } from './ballot';

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
    expect(deckState(deck, decided('a', 'b', 'c'))).toMatchObject({
      current: null,
      decided: 3,
      previous: deck[2],
    });
  });

  it('undoes the latest decision, wherever it is in the deck', () => {
    // Pre-filled from the bet: 'a' and 'c' were decided before the new card 'b'.
    expect(deckState(deck, decided('a', 'c', 'b'))).toMatchObject({
      current: null,
      previous: deck[1],
    });
    expect(deckState(deck, decided('c', 'gone'))).toMatchObject({
      current: deck[0],
      previous: deck[2],
    });
  });

  it('ignores entries for politicians no longer in the deck', () => {
    expect(deckState(deck, decided('a', 'gone'))).toMatchObject({ current: deck[1], decided: 1 });
  });
});

describe('reviewState', () => {
  const entry = (politicianId: string, isCandidate: boolean) => ({ politicianId, isCandidate });

  it('splits decided candidates and keeps the pool order', () => {
    const review = reviewState(deck, [entry('c', true), entry('b', false), entry('a', true)]);
    expect(review).toEqual({
      kept: [deck[0], deck[2]],
      dropped: [deck[1]],
      undecided: 0,
      blocker: null,
    });
  });

  it('is incomplete while a candidate is undecided', () => {
    const review = reviewState(deck, [entry('a', true), entry('b', true)]);
    expect(review).toMatchObject({ undecided: 1, blocker: ErrorCode.BALLOT_INCOMPLETE });
  });

  it('needs at least two kept candidates', () => {
    const review = reviewState(deck, [entry('a', true), entry('b', false), entry('c', false)]);
    expect(review.blocker).toBe(ErrorCode.TOO_FEW_CANDIDATES);
  });

  it('ignores decisions outside the pool', () => {
    const review = reviewState(deck, [entry('a', true), entry('b', true), entry('x', true)]);
    expect(review).toMatchObject({ kept: [deck[0], deck[1]], undecided: 1 });
  });
});

describe('newProfiles', () => {
  it('lists pool candidates the bet does not decide on', () => {
    const ballot = {
      validatedAt: '2026-10-30T10:00:00.000Z',
      entries: [
        { politicianId: 'a', isCandidate: true },
        { politicianId: 'gone', isCandidate: true },
        { politicianId: 'c', isCandidate: false },
      ],
    };
    expect(newProfiles(deck, ballot)).toEqual([deck[1]]);
    expect(newProfiles(deck.slice(0, 1), ballot)).toEqual([]);
  });
});
