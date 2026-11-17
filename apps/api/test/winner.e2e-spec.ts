import { type CandidateStatus, ErrorCode } from '@presidency-bingo/shared';
import { type ElectionSeed, seedElection } from '../src/seed/election-seed.js';
import { createTestApp, type TestApp } from './test-app.js';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const candidate = (slug: string, status: CandidateStatus = 'DECLARED') => ({
  slug,
  name: slug,
  photoUrl: null,
  photoCredit: null,
  partyLabel: 'Parti',
  tagline: 'Fonction',
  status,
  source: 'test',
});

/** Qualifiers and winner open; anne and bruno are favorites, chloe and david are not. */
const open = (overrides: Partial<ElectionSeed['election']> = {}) =>
  ({
    election: {
      slug: 'presidentielle-test',
      name: 'Présidentielle test',
      firstRoundAt: inDays(20),
      secondRoundAt: inDays(34),
      predictionsLockAt: inDays(10),
      firstRoundClosesAt: inDays(18),
      ...overrides,
    },
    candidates: ['anne', 'bruno', 'chloe', 'david'].map((slug) => candidate(slug)),
    favorites: [
      { slug: 'anne', odds: 90 },
      { slug: 'bruno', odds: 500 },
      { slug: null, odds: 1000 },
    ],
  }) satisfies ElectionSeed;

const BASE = '/api/elections/current/winner';
const DRAFT = `${BASE}/draft`;
const VALIDATE = `${DRAFT}/validate`;
const BALLOT = `${BASE}/ballot`;
const FAVORITES = `${BASE}/favorites`;

type Agent = Awaited<ReturnType<TestApp['signUp']>>;

const phaseStates = async (agent: Agent) => {
  const res = await agent.get('/api/elections/current/phases').expect(200);
  return Object.fromEntries(
    res.body.phases.map((p: { phase: string; state: string }) => [p.phase, p.state]),
  );
};

describe('Winner predictions (e2e)', () => {
  let t: TestApp;
  /** Favorite ids, by politician slug; "other" for "autre candidat". */
  let favorites: Map<string, string>;
  const favorite = (key: string) => favorites.get(key) ?? key;

  const seed = async (input: ElectionSeed) => {
    await seedElection(t.prisma, input);
    const rows = await t.prisma.favorite.findMany({ include: { politician: true } });
    favorites = new Map(rows.map((f) => [f.politician?.slug ?? 'other', f.id]));
  };

  /** A validated qualifiers' prediction, written directly. */
  const validateQualifiers = async (email = 'ada@example.com') => {
    const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
    const { id: electionId } = await t.prisma.election.findFirstOrThrow();
    await t.prisma.ballot.create({
      data: {
        userId: user.id,
        electionId,
        phase: 'QUALIFIERS',
        status: 'VALIDATED',
        validatedAt: new Date(),
      },
    });
  };

  /** A player who cleared the qualifiers. */
  const player = async (user: { name: string; email: string } = ada) => {
    const agent = await t.signUp(user);
    await validateQualifiers(user.email);
    return agent;
  };
  const ada = { name: 'Ada', email: 'ada@example.com' };
  const bob = { name: 'Bob', email: 'bob@example.com' };

  const choose = (agent: Agent, key: string) =>
    agent.put(DRAFT).send({ favoriteId: favorite(key) });

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.app.close());
  beforeEach(async () => {
    await t.reset();
    await seed(open());
  });

  it('lists the favorites in order with their odds, "autre candidat" last', async () => {
    const agent = await t.signUp();
    const res = await agent.get(FAVORITES).expect(200);
    expect(
      res.body.favorites.map((f: { odds: number; politician: { name: string } | null }) => [
        f.politician?.name ?? null,
        f.odds,
      ]),
    ).toEqual([
      ['anne', 90],
      ['bruno', 500],
      [null, 1000],
    ]);
  });

  it('opens once the qualifiers are validated, and holds the first round back', async () => {
    const agent = await t.signUp();
    expect(await phaseStates(agent)).toMatchObject({ WINNER: 'UPCOMING' });
    const refused = await choose(agent, 'anne').expect(403);
    expect(refused.body.code).toBe(ErrorCode.PREDICTIONS_NOT_OPEN);

    await validateQualifiers();
    expect(await phaseStates(agent)).toMatchObject({
      WINNER: 'TODO',
      FIRST_ROUND: 'UPCOMING',
    });
  });

  it('records one choice in a draft, then validates it', async () => {
    const agent = await player();
    expect((await agent.get(DRAFT).expect(200)).body).toEqual({ favoriteId: null });
    await choose(agent, 'anne').expect(200);
    const chosen = await choose(agent, 'other').expect(200);
    expect(chosen.body).toEqual({ favoriteId: favorite('other') });
    expect((await agent.get(DRAFT).expect(200)).body).toEqual({ favoriteId: favorite('other') });
    expect((await agent.get(BALLOT).expect(200)).body).toEqual({ ballot: null, points: null });

    const validated = await agent.post(VALIDATE).expect(200);
    expect(validated.body.favoriteId).toBe(favorite('other'));
    expect((await agent.get(DRAFT).expect(200)).body).toEqual({ favoriteId: null });
    expect((await agent.get(BALLOT).expect(200)).body).toEqual({
      ballot: { validatedAt: validated.body.validatedAt, favoriteId: favorite('other') },
      points: null,
    });
    expect(await phaseStates(agent)).toMatchObject({ WINNER: 'DONE', FIRST_ROUND: 'TODO' });
  });

  it('refuses to validate without a choice', async () => {
    const agent = await player();
    const res = await agent.post(VALIDATE).expect(422);
    expect(res.body.code).toBe(ErrorCode.BALLOT_INCOMPLETE);
  });

  it('refuses a favorite of another election, and a malformed id', async () => {
    const agent = await player();
    const unknown = await agent
      .put(DRAFT)
      .send({ favoriteId: '01900000-0000-7000-8000-000000000000' })
      .expect(404);
    expect(unknown.body.code).toBe(ErrorCode.UNKNOWN_FAVORITE);
    const malformed = await agent.put(DRAFT).send({ favoriteId: 'anne' }).expect(400);
    expect(malformed.body.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('changes the choice: the validated one counts until the new one is validated', async () => {
    const agent = await player();
    await choose(agent, 'anne').expect(200);
    await agent.post(VALIDATE).expect(200);

    await choose(agent, 'bruno').expect(200);
    expect((await agent.get(BALLOT).expect(200)).body.ballot.favoriteId).toBe(favorite('anne'));
    await agent.post(VALIDATE).expect(200);
    expect((await agent.get(BALLOT).expect(200)).body.ballot.favoriteId).toBe(favorite('bruno'));
  });

  it('keeps a choice whose favorite dropped out', async () => {
    const agent = await player();
    await choose(agent, 'bruno').expect(200);
    await agent.post(VALIDATE).expect(200);
    const input = open();
    await seed({
      ...input,
      candidates: input.candidates.map((c) =>
        c.slug === 'bruno' ? candidate('bruno', 'WITHDRAWN') : c,
      ),
    });
    expect((await agent.get(BALLOT).expect(200)).body.ballot.favoriteId).toBe(favorite('bruno'));
    await choose(agent, 'anne').expect(200);
  });

  it('refuses every write once closed, and keeps the prediction readable', async () => {
    const agent = await player();
    await choose(agent, 'anne').expect(200);
    await agent.post(VALIDATE).expect(200);
    await seed(open({ predictionsLockAt: inDays(-1) }));

    expect(await phaseStates(agent)).toMatchObject({ WINNER: 'CLOSED' });
    for (const res of [await choose(agent, 'bruno'), await agent.post(VALIDATE)]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.PREDICTIONS_LOCKED);
    }
    expect((await agent.get(BALLOT).expect(200)).body.ballot.favoriteId).toBe(favorite('anne'));
  });

  it('scores the odds of the choice once the president is elected', async () => {
    const adaAgent = await player(ada);
    const bobAgent = await player(bob);
    await choose(adaAgent, 'bruno').expect(200);
    await adaAgent.post(VALIDATE).expect(200);
    await choose(bobAgent, 'other').expect(200);
    await bobAgent.post(VALIDATE).expect(200);

    await seed(open({ electedSlug: 'bruno' }));
    expect((await adaAgent.get(BALLOT).expect(200)).body.points).toBe(500);
    expect((await bobAgent.get(BALLOT).expect(200)).body.points).toBe(0);

    // "Autre candidat" wins when the elected is none of the favorites.
    await seed(open({ electedSlug: 'chloe' }));
    expect((await adaAgent.get(BALLOT).expect(200)).body.points).toBe(0);
    expect((await bobAgent.get(BALLOT).expect(200)).body.points).toBe(1000);
  });

  it('lets players through when the election has no favorites', async () => {
    await t.reset();
    await seed({ ...open(), favorites: [] });
    const agent = await player();
    expect(await phaseStates(agent)).toMatchObject({ WINNER: 'UPCOMING', FIRST_ROUND: 'TODO' });
  });

  it('reads the latest validated choices through winner_choices', async () => {
    const agent = await player();
    await choose(agent, 'anne').expect(200);
    await agent.post(VALIDATE).expect(200);
    await choose(agent, 'other').expect(200);
    await agent.post(VALIDATE).expect(200);
    const bobAgent = await player(bob);
    await choose(bobAgent, 'bruno').expect(200); // a draft: not read

    const rows = await t.prisma.$queryRaw<
      { favorite_id: string; politician_id: string | null; odds: number }[]
    >`SELECT favorite_id, politician_id, odds FROM winner_choices`;
    expect(rows).toEqual([{ favorite_id: favorite('other'), politician_id: null, odds: 1000 }]);
  });

  it('refuses invalid favorites in the seed', async () => {
    const input = open();
    await expect(
      seedElection(t.prisma, { ...input, favorites: [{ slug: 'zoe', odds: 100 }] }),
    ).rejects.toThrow(/Not a candidate of the file/);
    await expect(
      seedElection(t.prisma, {
        ...input,
        favorites: [
          { slug: null, odds: 100 },
          { slug: null, odds: 200 },
        ],
      }),
    ).rejects.toThrow(/Listed twice/);
    await expect(
      seedElection(t.prisma, { ...input, favorites: [{ slug: 'anne', odds: 0 }] }),
    ).rejects.toThrow();
  });

  it('requires authentication', async () => {
    const res = await t.http().get(FAVORITES).expect(401);
    expect(res.body.code).toBe(ErrorCode.UNAUTHENTICATED);
  });
});
