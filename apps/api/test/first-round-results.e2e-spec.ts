import type { CandidateStatus } from '@presidency-bingo/shared';
import { type ElectionSeed, seedElection } from '../src/seed/election-seed.js';
import { createTestApp, type TestApp } from './test-app.js';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const candidate = (
  slug: string,
  status: CandidateStatus,
  firstRoundScore: number | null = null,
) => ({
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

const election = {
  slug: 'presidentielle-test',
  name: 'Présidentielle test',
  firstRoundAt: inDays(-3),
  secondRoundAt: inDays(11),
  predictionsLockAt: inDays(-30),
  officialListPublishedAt: inDays(-20),
};

/** First round open: anne, bruno, chloe and emma qualified. */
const open = {
  election: { ...election, firstRoundAt: inDays(5), firstRoundClosesAt: inDays(3) },
  candidates: [
    candidate('anne', 'QUALIFIED'),
    candidate('bruno', 'QUALIFIED'),
    candidate('chloe', 'QUALIFIED'),
    candidate('david', 'NOT_QUALIFIED'),
    candidate('emma', 'QUALIFIED'),
  ],
} satisfies ElectionSeed;

/** First round played; emma withdrew before the vote. Scores in %. */
const played = (
  scores: { anne: number; bruno: number; chloe: number } | null,
  results: Partial<ElectionSeed['election']> = {},
) =>
  ({
    election: {
      ...election,
      firstRoundClosesAt: inDays(-4),
      firstRoundResultsAt: scores ? inDays(-2) : null,
      ...results,
    },
    candidates: [
      candidate('anne', 'QUALIFIED', scores?.anne ?? null),
      candidate('bruno', 'QUALIFIED', scores?.bruno ?? null),
      candidate('chloe', 'QUALIFIED', scores?.chloe ?? null),
      candidate('david', 'NOT_QUALIFIED'),
      candidate('emma', 'WITHDRAWN'),
    ],
  }) satisfies ElectionSeed;

const provisional = { anne: 40, bruno: 35, chloe: 25 };
const official = { anne: 40.5, bruno: 34.5, chloe: 25 };

const BASE = '/api/elections/current/first-round';
const RESULTS = `${BASE}/results`;

type Agent = Awaited<ReturnType<TestApp['signUp']>>;

describe('First-round results (e2e)', () => {
  let t: TestApp;
  let ids: Map<string, string>;
  const id = (slug: string) => ids.get(slug) ?? slug;

  const seed = async (input: ElectionSeed) => {
    await seedElection(t.prisma, input);
    const politicians = await t.prisma.politician.findMany();
    ids = new Map(politicians.map((p) => [p.slug, p.id]));
  };

  /** Validates a first-round prediction, scores in tenths of a point by slug. */
  const predict = async (agent: Agent, scores: Record<string, number>) => {
    for (const [slug, score] of Object.entries(scores)) {
      await agent
        .put(`${BASE}/draft/entries/${id(slug)}`)
        .send({ score })
        .expect(200);
    }
    await agent.post(`${BASE}/draft/validate`).expect(200);
  };

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.app.close());
  beforeEach(async () => {
    await t.reset();
    await seed(open);
  });

  it('exposes no point before the results are published', async () => {
    const ada = await t.signUp();
    await predict(ada, { anne: 400, bruno: 350, chloe: 250 });

    const before = { published: false, final: false, result: null };
    expect((await ada.get(RESULTS).expect(200)).body).toEqual(before);
    await seed(played(null));
    expect((await ada.get(RESULTS).expect(200)).body).toEqual(before);
    // Scores already in, but published tomorrow.
    await seed(played(provisional, { firstRoundResultsAt: inDays(1) }));
    expect((await ada.get(RESULTS).expect(200)).body).toEqual(before);
  });

  it('scores each candidate by its gap, plus the right finalists', async () => {
    const ada = await t.signUp();
    // emma's line is ignored once she withdrew, without renormalizing the others.
    await predict(ada, { anne: 400, bruno: 300, chloe: 252, emma: 100 });
    await seed(played(provisional));

    const { body } = await ada.get(RESULTS).expect(200);
    expect(body).toMatchObject({ published: true, final: false });
    expect(body.result).toMatchObject({ finalists: 2, bonus: 100 });
    expect(body.result.entries).toEqual([
      {
        politicianId: id('anne'),
        name: 'anne',
        photoUrl: null,
        predicted: 400,
        actual: 4000,
        gap: 0,
        points: 30,
        predictedFinalist: true,
        finalist: true,
      },
      expect.objectContaining({ politicianId: id('bruno'), predicted: 300, gap: 500, points: 0 }),
      // Threshold: 2.5 points (10 % of 25); 30 * ((250 - 20) / (250 - 10))² = 27.55.
      expect.objectContaining({
        politicianId: id('chloe'),
        predicted: 252,
        actual: 2500,
        gap: 20,
        points: 27.6,
        predictedFinalist: false,
        finalist: false,
      }),
    ]);
    // 30 + 0 + 27.55 + 100, rounded once.
    expect(body.result.points).toBe(158);
  });

  it('gives 50 points for a single right finalist', async () => {
    const bob = await t.signUp({ name: 'Bob', email: 'bob@example.com' });
    await predict(bob, { anne: 300, chloe: 400 });
    await seed(played(provisional));

    const { body } = await bob.get(RESULTS).expect(200);
    expect(body.result).toMatchObject({ finalists: 1, bonus: 50 });
  });

  it('follows the official results replacing the provisional ones', async () => {
    const ada = await t.signUp();
    await predict(ada, { anne: 400, bruno: 300, chloe: 252 });
    await seed(played(provisional));
    expect((await ada.get(RESULTS).expect(200)).body.result.points).toBe(158);

    await seed(played(official, { firstRoundResultsFinal: true }));
    const { body } = await ada.get(RESULTS).expect(200);
    expect(body.final).toBe(true);
    // anne: gap 0.5 point against a threshold of 4.05: 30 * ((405 - 50) / (405 - 10))² = 24.23.
    expect(body.result.entries[0]).toMatchObject({ actual: 4050, gap: 50, points: 24.2 });
    expect(body.result.points).toBe(152);
  });

  it('has no result for a player who never validated a prediction', async () => {
    const ada = await t.signUp();
    await ada
      .put(`${BASE}/draft/entries/${id('anne')}`)
      .send({ score: 400 })
      .expect(200);
    await seed(played(provisional));

    expect((await ada.get(RESULTS).expect(200)).body).toEqual({
      published: true,
      final: false,
      result: null,
    });
  });

  it('requires authentication', async () => {
    await t.http().get(RESULTS).expect(401);
  });
});
