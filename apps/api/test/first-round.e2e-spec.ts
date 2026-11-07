import { type CandidateStatus, ErrorCode } from '@presidency-bingo/shared';
import { type ElectionSeed, seedElection } from '../src/seed/election-seed.js';
import { createTestApp, type TestApp } from './test-app.js';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const candidate = (slug: string, status: CandidateStatus) => ({
  slug,
  name: slug,
  photoUrl: null,
  photoCredit: null,
  partyLabel: 'Parti',
  tagline: 'Fonction',
  status,
  source: 'test',
});

const election = {
  slug: 'presidentielle-test',
  name: 'Présidentielle test',
  firstRoundAt: inDays(20),
  secondRoundAt: inDays(34),
  predictionsLockAt: inDays(-10),
  firstRoundClosesAt: inDays(18),
};

/** Qualifiers closed, official list not published yet: the first round isn't open. */
const beforeList = {
  election,
  candidates: ['anne', 'bruno', 'chloe', 'david'].map((slug) => candidate(slug, 'DECLARED')),
} satisfies ElectionSeed;

/** Official list published: anne, bruno and chloe qualified. */
const published = (overrides: Partial<ElectionSeed['election']> = {}) =>
  ({
    election: { ...election, officialListPublishedAt: inDays(-1), ...overrides },
    candidates: [
      candidate('anne', 'QUALIFIED'),
      candidate('bruno', 'QUALIFIED'),
      candidate('chloe', 'QUALIFIED'),
      candidate('david', 'NOT_QUALIFIED'),
    ],
  }) satisfies ElectionSeed;

const BASE = '/api/elections/current/first-round';
const DRAFT = `${BASE}/draft`;
const VALIDATE = `${DRAFT}/validate`;
const BALLOT = `${BASE}/ballot`;

type Agent = Awaited<ReturnType<TestApp['signUp']>>;

describe('First-round predictions (e2e)', () => {
  let t: TestApp;
  let ids: Map<string, string>;
  const id = (slug: string) => ids.get(slug) ?? slug;
  const entry = (slug: string) => `${DRAFT}/entries/${id(slug)}`;

  /** Scores in tenths of a point, by slug. */
  const score = async (agent: Agent, scores: Record<string, number>) => {
    for (const [slug, value] of Object.entries(scores)) {
      await agent.put(entry(slug)).send({ score: value }).expect(200);
    }
  };
  const sorted = (entries: { politicianId: string; score: number }[]) =>
    [...entries].sort((a, b) => a.politicianId.localeCompare(b.politicianId));
  const asEntries = (scores: Record<string, number>) =>
    sorted(Object.entries(scores).map(([slug, s]) => ({ politicianId: id(slug), score: s })));

  const seed = async (input: ElectionSeed) => {
    await seedElection(t.prisma, input);
    const politicians = await t.prisma.politician.findMany();
    ids = new Map(politicians.map((p) => [p.slug, p.id]));
  };

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.app.close());
  beforeEach(async () => {
    await t.reset();
    await seed(published());
  });

  it('opens at the publication of the official list', async () => {
    await t.reset();
    await seed(beforeList);
    const ada = await t.signUp();

    const before = await ada.get('/api/elections/current').expect(200);
    expect(before.body.firstRound).toEqual({
      opensAt: null,
      closesAt: election.firstRoundClosesAt,
      status: 'UPCOMING',
    });
    const refused = await ada.put(entry('anne')).send({ score: 300 }).expect(403);
    expect(refused.body.code).toBe(ErrorCode.PREDICTIONS_NOT_OPEN);
    await ada.post(DRAFT).expect(403);

    // A publication date in the future doesn't open it either.
    await seed(published({ officialListPublishedAt: inDays(1) }));
    await ada.put(entry('anne')).send({ score: 300 }).expect(403);

    await seed(published());
    const after = await ada.get('/api/elections/current').expect(200);
    expect(after.body.firstRound.status).toBe('OPEN');
    await ada.put(entry('anne')).send({ score: 300 }).expect(200);
  });

  it('stays closed while its closing is unknown', async () => {
    await seed(published({ firstRoundClosesAt: null }));
    const ada = await t.signUp();
    await ada.put(entry('anne')).send({ score: 300 }).expect(403);
  });

  it('is open to players who never predicted the qualifiers', async () => {
    const ada = await t.signUp();
    expect((await ada.get(DRAFT).expect(200)).body).toEqual({ entries: [] });
    expect((await ada.get(BALLOT).expect(200)).body).toEqual({ ballot: null });

    const res = await ada.put(entry('anne')).send({ score: 234 }).expect(200);
    expect(res.body).toEqual({ politicianId: id('anne'), score: 234 });
    await score(ada, { anne: 250 });
    expect((await ada.get(DRAFT).expect(200)).body.entries).toEqual([
      { politicianId: id('anne'), score: 250 },
    ]);
  });

  it('only takes the qualified candidates', async () => {
    const ada = await t.signUp();
    const res = await ada.put(entry('david')).send({ score: 100 }).expect(404);
    expect(res.body.code).toBe(ErrorCode.UNKNOWN_CANDIDATE);
  });

  it('takes whole tenths of a point between 0 and 100 %', async () => {
    const ada = await t.signUp();
    for (const body of [{ score: 23.4 }, { score: 1001 }, { score: -1 }, { isCandidate: true }]) {
      const res = await ada.put(entry('anne')).send(body).expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    }
    await score(ada, { anne: 0, bruno: 1000 });
  });

  it('validates whatever the total, a candidate without a score counting as 0 %', async () => {
    const ada = await t.signUp();
    // No draft yet: every score is 0 %.
    const empty = await ada.post(VALIDATE).expect(200);
    expect(sorted(empty.body.entries)).toEqual(asEntries({ anne: 0, bruno: 0, chloe: 0 }));

    await ada.post(DRAFT).expect(200);
    await score(ada, { anne: 600, bruno: 300 });
    await ada.delete(entry('chloe')).expect(204);
    const validated = await ada.post(VALIDATE).expect(200);
    expect(sorted(validated.body.entries)).toEqual(asEntries({ anne: 600, bruno: 300, chloe: 0 }));
    expect((await ada.get(DRAFT).expect(200)).body).toEqual({ entries: [] });
    const current = await ada.get(BALLOT).expect(200);
    expect(current.body.ballot.validatedAt).toBe(validated.body.validatedAt);

    // Past 100 % too.
    await score(ada, { anne: 1000, bruno: 1000 });
    const over = await ada.post(VALIDATE).expect(200);
    expect(sorted(over.body.entries)).toEqual(asEntries({ anne: 1000, bruno: 1000, chloe: 0 }));
  });

  it('reopens a draft pre-filled from the latest validated prediction', async () => {
    const ada = await t.signUp();
    await score(ada, { anne: 400, bruno: 400, chloe: 200 });
    await ada.post(VALIDATE).expect(200);

    const draft = await ada.post(DRAFT).expect(200);
    expect(sorted(draft.body.entries)).toEqual(asEntries({ anne: 400, bruno: 400, chloe: 200 }));
    await score(ada, { anne: 300, chloe: 300 });
    // The validated prediction still counts until the new one is validated.
    expect(sorted((await ada.get(BALLOT).expect(200)).body.ballot.entries)).toEqual(
      asEntries({ anne: 400, bruno: 400, chloe: 200 }),
    );
    await ada.post(VALIDATE).expect(200);
    expect(sorted((await ada.get(BALLOT).expect(200)).body.ballot.entries)).toEqual(
      asEntries({ anne: 300, bruno: 400, chloe: 300 }),
    );
  });

  it('undoes a score, idempotently', async () => {
    const ada = await t.signUp();
    await score(ada, { anne: 400, bruno: 400 });
    await ada.delete(entry('bruno')).expect(204);
    await ada.delete(entry('bruno')).expect(204);
    expect((await ada.get(DRAFT).expect(200)).body.entries).toEqual([
      { politicianId: id('anne'), score: 400 },
    ]);
  });

  it('refuses every write once closed, and keeps the prediction readable', async () => {
    const ada = await t.signUp();
    await score(ada, { anne: 400, bruno: 400, chloe: 200 });
    await ada.post(VALIDATE).expect(200);
    await seed(published({ firstRoundClosesAt: inDays(-1) }));

    const election = await ada.get('/api/elections/current').expect(200);
    expect(election.body.firstRound.status).toBe('CLOSED');
    for (const res of [
      await ada.put(entry('anne')).send({ score: 500 }),
      await ada.delete(entry('anne')),
      await ada.post(DRAFT),
      await ada.post(VALIDATE),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.PREDICTIONS_LOCKED);
    }
    expect((await ada.get(BALLOT).expect(200)).body.ballot.entries).toHaveLength(3);
  });

  it('keeps the phases apart', async () => {
    const ada = await t.signUp();
    await score(ada, { anne: 400, bruno: 400, chloe: 200 });
    await ada.post(VALIDATE).expect(200);

    // The qualifiers' prediction is untouched: no draft, no bet, and its writes stay closed.
    expect((await ada.get('/api/elections/current/draft').expect(200)).body).toEqual({
      entries: [],
    });
    expect((await ada.get('/api/elections/current/ballot').expect(200)).body).toEqual({
      ballot: null,
    });
    const qualifiers = await ada
      .put(`/api/elections/current/draft/entries/${id('anne')}`)
      .send({ isCandidate: true })
      .expect(403);
    expect(qualifiers.body.code).toBe(ErrorCode.PREDICTIONS_LOCKED);
    // A first-round prediction is no qualifiers' bet: still no result.
    expect((await ada.get('/api/elections/current/results').expect(200)).body).toEqual({
      published: true,
      result: null,
    });
  });

  it('reads the latest validated predictions through round_scores', async () => {
    const ada = await t.signUp();
    const bob = await t.signUp({ name: 'Bob', email: 'bob@example.com' });
    await score(ada, { anne: 400, bruno: 400, chloe: 200 });
    await ada.post(VALIDATE).expect(200);
    await ada.post(DRAFT).expect(200);
    await score(ada, { anne: 500, bruno: 300 });
    await ada.post(VALIDATE).expect(200);
    await score(bob, { anne: 1000 }); // a draft: not read

    const rows = await t.prisma.$queryRaw<
      { user_id: string; phase: string; politician_id: string; score: number }[]
    >`SELECT user_id, phase::text, politician_id, score FROM round_scores ORDER BY score DESC`;
    const user = await t.prisma.user.findUniqueOrThrow({ where: { email: 'ada@example.com' } });
    expect(rows).toEqual([
      { user_id: user.id, phase: 'FIRST_ROUND', politician_id: id('anne'), score: 500 },
      { user_id: user.id, phase: 'FIRST_ROUND', politician_id: id('bruno'), score: 300 },
      { user_id: user.id, phase: 'FIRST_ROUND', politician_id: id('chloe'), score: 200 },
    ]);
  });

  it('requires authentication', async () => {
    const res = await t.http().get(DRAFT).expect(401);
    expect(res.body.code).toBe(ErrorCode.UNAUTHENTICATED);
  });
});
