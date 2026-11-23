import { applyStep, isLocalDatabase } from './simulation.js';

const NOW = new Date('2026-11-24T12:00:00Z');

const candidate = (slug: string, status: string) => ({
  slug,
  name: slug,
  photoUrl: null,
  photoCredit: null,
  partyLabel: 'Parti',
  tagline: 'Fonction',
  status,
  source: 'test',
});

const base = {
  election: {
    slug: 'presidentielle-test',
    name: 'Présidentielle test',
    firstRoundAt: '2027-04-18T06:00:00Z',
    secondRoundAt: '2027-05-02T06:00:00Z',
    predictionsLockAt: '2027-03-12T22:59:59Z',
    officialListPublishedAt: null,
  },
  favorites: [{ slug: 'anne', odds: 90 }],
  candidates: [
    candidate('anne', 'DECLARED'),
    candidate('bruno', 'POTENTIAL'),
    candidate('chloe', 'DECLARED'),
    candidate('william', 'WITHDRAWN'),
  ],
};

describe('applyStep', () => {
  it('overrides the election, relative dates counted from now', () => {
    const { election } = applyStep(
      base,
      { election: { officialListPublishedAt: '-10d', firstRoundClosesAt: '+2h', name: 'Simu' } },
      NOW,
    );
    expect(election).toMatchObject({
      slug: 'presidentielle-test',
      name: 'Simu',
      officialListPublishedAt: '2026-11-14T12:00:00.000Z',
      firstRoundClosesAt: '2026-11-24T14:00:00.000Z',
      predictionsLockAt: '2027-03-12T22:59:59Z',
    });
  });

  it('sets the listed candidates, and the others to othersStatus except the withdrawn', () => {
    const { candidates, favorites } = applyStep(
      base,
      {
        othersStatus: 'NOT_QUALIFIED',
        candidates: { anne: { status: 'QUALIFIED', firstRoundScore: 60 }, bruno: {} },
      },
      NOW,
    );
    expect(
      candidates.map((c) => [
        c.slug,
        c.status,
        'firstRoundScore' in c ? c.firstRoundScore : undefined,
      ]),
    ).toEqual([
      ['anne', 'QUALIFIED', 60],
      ['bruno', 'POTENTIAL', undefined],
      ['chloe', 'NOT_QUALIFIED', undefined],
      ['william', 'WITHDRAWN', undefined],
    ]);
    expect(favorites).toEqual(base.favorites);
  });

  it('rejects an unknown candidate or a malformed relative date', () => {
    expect(() => applyStep(base, { candidates: { zoe: { status: 'QUALIFIED' } } }, NOW)).toThrow(
      /zoe/,
    );
    expect(() => applyStep(base, { election: { firstRoundAt: '+3 days' } }, NOW)).toThrow();
  });
});

describe('isLocalDatabase', () => {
  it('only accepts a database on this machine', () => {
    expect(isLocalDatabase('postgresql://app:app@localhost:5432/app')).toBe(true);
    expect(isLocalDatabase('postgresql://app:app@127.0.0.1:5432/app')).toBe(true);
    expect(isLocalDatabase('postgresql://app:secret@postgres:5432/app')).toBe(false);
    expect(isLocalDatabase(undefined)).toBe(false);
  });
});
