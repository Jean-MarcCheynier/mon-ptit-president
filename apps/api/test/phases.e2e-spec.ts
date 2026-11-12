import { ErrorCode, type PlayerPhaseDto } from '@presidency-bingo/shared';
import { type ElectionSeed, seedElection } from '../src/seed/election-seed.js';
import { createTestApp, type TestApp } from './test-app.js';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const candidate = (slug: string) => ({
  slug,
  name: slug,
  photoUrl: null,
  photoCredit: null,
  partyLabel: 'Parti',
  tagline: 'Fonction',
  status: 'DECLARED' as const,
  source: 'test',
});

/** Qualifiers open, first round scheduled after them. */
const fixture = {
  election: {
    slug: 'presidentielle-test',
    name: 'Présidentielle test',
    firstRoundAt: inDays(60),
    secondRoundAt: inDays(74),
    predictionsLockAt: inDays(30),
    firstRoundClosesAt: inDays(55),
  },
  candidates: ['anne', 'bruno', 'chloe'].map(candidate),
} satisfies ElectionSeed;

const PHASES = '/api/elections/current/phases';
const QUALIFIERS = '/api/elections/current/draft';
const FIRST_ROUND = '/api/elections/current/first-round/draft';

type Agent = Awaited<ReturnType<TestApp['signUp']>>;

describe('Phases (e2e)', () => {
  let t: TestApp;
  let ids: Map<string, string>;
  const id = (slug: string) => ids.get(slug) ?? slug;

  const states = async (agent: Agent) => {
    const res = await agent.get(PHASES).expect(200);
    return Object.fromEntries((res.body.phases as PlayerPhaseDto[]).map((p) => [p.phase, p.state]));
  };
  const validateQualifiers = async (agent: Agent) => {
    for (const slug of ['anne', 'bruno', 'chloe']) {
      await agent
        .put(`${QUALIFIERS}/entries/${id(slug)}`)
        .send({ isCandidate: slug !== 'chloe' })
        .expect(200);
    }
    await agent.post(`${QUALIFIERS}/validate`).expect(200);
  };
  const closeQualifiers = () =>
    t.prisma.election.updateMany({ data: { predictionsLockAt: new Date(Date.now() - 1000) } });

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.app.close());
  beforeEach(async () => {
    await t.reset();
    await seedElection(t.prisma, fixture);
    const politicians = await t.prisma.politician.findMany();
    ids = new Map(politicians.map((p) => [p.slug, p.id]));
  });

  it('lists the five phases in order, with their closing and whether they are built', async () => {
    const ada = await t.signUp();
    const res = await ada.get(PHASES).expect(200);
    expect(res.body.phases).toEqual([
      { phase: 'PRESENTATION', state: 'UPCOMING', closesAt: null, playable: false },
      {
        phase: 'QUALIFIERS',
        state: 'TODO',
        closesAt: fixture.election.predictionsLockAt,
        playable: true,
      },
      {
        phase: 'WINNER',
        state: 'UPCOMING',
        closesAt: fixture.election.predictionsLockAt,
        playable: false,
      },
      {
        phase: 'FIRST_ROUND',
        state: 'UPCOMING',
        closesAt: fixture.election.firstRoundClosesAt,
        playable: true,
      },
      { phase: 'SECOND_ROUND', state: 'UPCOMING', closesAt: null, playable: false },
    ]);
  });

  it('refuses the first round until the qualifiers are validated', async () => {
    const ada = await t.signUp();
    for (const res of [
      await ada.put(`${FIRST_ROUND}/entries/${id('anne')}`).send({ score: 300 }),
      await ada.post(FIRST_ROUND),
      await ada.post(`${FIRST_ROUND}/validate`),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ErrorCode.PREDICTIONS_NOT_OPEN);
    }
    // Reads stay available.
    await ada.get(FIRST_ROUND).expect(200);

    await validateQualifiers(ada);
    expect(await states(ada)).toMatchObject({ QUALIFIERS: 'DONE', FIRST_ROUND: 'TODO' });
    await ada
      .put(`${FIRST_ROUND}/entries/${id('anne')}`)
      .send({ score: 300 })
      .expect(200);
    await ada.post(`${FIRST_ROUND}/validate`).expect(200);
    expect(await states(ada)).toMatchObject({ QUALIFIERS: 'DONE', FIRST_ROUND: 'DONE' });
  });

  it('keeps the next phases open while a done phase is edited again', async () => {
    const ada = await t.signUp();
    await validateQualifiers(ada);
    await ada.post(QUALIFIERS).expect(200);
    await ada.delete(`${QUALIFIERS}/entries/${id('anne')}`).expect(204);

    expect(await states(ada)).toMatchObject({ QUALIFIERS: 'DONE', FIRST_ROUND: 'TODO' });
    await ada
      .put(`${FIRST_ROUND}/entries/${id('anne')}`)
      .send({ score: 300 })
      .expect(200);
  });

  it('skips a phase closed without a validated prediction, and opens the next one', async () => {
    const ada = await t.signUp();
    const bob = await t.signUp({ name: 'Bob', email: 'bob@example.com' });
    await validateQualifiers(bob);
    await closeQualifiers();

    expect(await states(ada)).toMatchObject({
      QUALIFIERS: 'SKIPPED',
      WINNER: 'SKIPPED',
      FIRST_ROUND: 'TODO',
    });
    expect(await states(bob)).toMatchObject({ QUALIFIERS: 'CLOSED', FIRST_ROUND: 'TODO' });
    await ada
      .put(`${FIRST_ROUND}/entries/${id('anne')}`)
      .send({ score: 300 })
      .expect(200);

    const locked = await ada.put(`${QUALIFIERS}/entries/${id('anne')}`).send({ isCandidate: true });
    expect(locked.status).toBe(403);
    expect(locked.body.code).toBe(ErrorCode.PREDICTIONS_LOCKED);
  });

  it('is per player', async () => {
    const ada = await t.signUp();
    const bob = await t.signUp({ name: 'Bob', email: 'bob@example.com' });
    await validateQualifiers(ada);

    expect(await states(ada)).toMatchObject({ FIRST_ROUND: 'TODO' });
    expect(await states(bob)).toMatchObject({ FIRST_ROUND: 'UPCOMING' });
  });

  it('requires authentication', async () => {
    const res = await t.http().get(PHASES).expect(401);
    expect(res.body.code).toBe(ErrorCode.UNAUTHENTICATED);
  });
});
