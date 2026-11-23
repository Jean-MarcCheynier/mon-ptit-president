import { type ElectionSeed, electionSeedSchema } from './election-seed.js';

const candidate = (slug: string, status: string, firstRoundScore?: number | null) => ({
  slug,
  name: slug,
  photoUrl: null,
  photoCredit: null,
  partyLabel: 'Parti',
  tagline: 'Fonction',
  status,
  source: 'test',
  firstRoundScore,
});

const seed = (
  results: Partial<ElectionSeed['election']>,
  scores: { anne?: number | null; bruno?: number | null; david?: number | null },
) => ({
  election: {
    slug: 'presidentielle-test',
    name: 'Présidentielle test',
    firstRoundAt: '2027-04-18T06:00:00Z',
    secondRoundAt: '2027-05-02T06:00:00Z',
    predictionsLockAt: '2027-03-12T22:59:59Z',
    officialListPublishedAt: '2027-03-20T12:00:00Z',
    ...results,
  },
  candidates: [
    candidate('anne', 'QUALIFIED', scores.anne),
    candidate('bruno', 'QUALIFIED', scores.bruno),
    candidate('david', 'NOT_QUALIFIED', scores.david),
  ],
});

const RESULTS_AT = { firstRoundResultsAt: '2027-04-18T18:00:00Z' };
const issues = (input: unknown) =>
  electionSeedSchema.safeParse(input).error?.issues.map((i) => i.message) ?? [];

describe('electionSeedSchema, first-round results', () => {
  it('accepts the qualified candidates scored once the results are published', () => {
    const parsed = electionSeedSchema.parse(seed(RESULTS_AT, { anne: 55.12, bruno: 44.88 }));
    expect(parsed.candidates.map((c) => c.firstRoundScore)).toEqual([55.12, 44.88, null]);
    expect(parsed.election.firstRoundResultsFinal).toBe(false);
  });

  it('accepts no score before the results', () => {
    expect(issues(seed({}, {}))).toEqual([]);
    expect(issues(seed({}, { anne: 50 }))).toEqual([
      'Only the qualified candidates have a score, once the results are published',
    ]);
  });

  it('requires a score for every qualified candidate, and only for them', () => {
    expect(issues(seed(RESULTS_AT, { anne: 100 }))).toEqual([
      'Results published: every qualified candidate needs a score',
    ]);
    expect(issues(seed(RESULTS_AT, { anne: 50, bruno: 45, david: 5 }))).toEqual([
      'Only the qualified candidates have a score, once the results are published',
    ]);
  });

  it('rejects scores that do not add up to 100 %, or with more than two decimals', () => {
    expect(issues(seed(RESULTS_AT, { anne: 50, bruno: 40 }))).toEqual([
      'The first-round scores add up to 90 %, not 100 %',
    ]);
    expect(issues(seed(RESULTS_AT, { anne: 50.125, bruno: 49.875 }))).toEqual([
      'At most two decimals',
      'At most two decimals',
    ]);
  });

  it('rejects results before the official list, or official without a date', () => {
    expect(
      issues(seed({ ...RESULTS_AT, officialListPublishedAt: null }, { anne: 50, bruno: 50 })),
    ).toContain('Results before the official list');
    expect(issues(seed({ firstRoundResultsFinal: true }, {}))).toEqual([
      'Official results without a publication date',
    ]);
  });
});
