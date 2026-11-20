import { ErrorCode, ONBOARDING_VERSION, type PlayerPhaseDto } from '@presidency-bingo/shared';
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
const ONBOARDING = '/api/me/onboarding';
const QUALIFIERS = '/api/elections/current/draft';

type Agent = Awaited<ReturnType<TestApp['signUp']>>;

describe('Onboarding (e2e)', () => {
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

  it('starts a new player at the presentation, which holds the qualifiers back', async () => {
    const ada = await t.signUp({ onboarded: false });
    const me = await ada.get('/api/me').expect(200);
    expect(me.body.onboardingVersionSeen).toBe(0);
    expect(await states(ada)).toMatchObject({ PRESENTATION: 'TODO', QUALIFIERS: 'UPCOMING' });

    const res = await ada
      .put(`${QUALIFIERS}/entries/${id('anne')}`)
      .send({ isCandidate: true })
      .expect(403);
    expect(res.body.code).toBe(ErrorCode.PREDICTIONS_NOT_OPEN);
  });

  it('opens the qualifiers once the presentation is done or skipped, for good', async () => {
    const ada = await t.signUp({ onboarded: false });
    const res = await ada.post(ONBOARDING).expect(200);
    expect(res.body.onboardingVersionSeen).toBe(ONBOARDING_VERSION);
    expect(await states(ada)).toMatchObject({ PRESENTATION: 'DONE', QUALIFIERS: 'TODO' });

    // Reading it again changes nothing.
    await ada.post(ONBOARDING).expect(200);
    await validateQualifiers(ada);
    expect(await states(ada)).toMatchObject({ PRESENTATION: 'DONE', QUALIFIERS: 'DONE' });
  });

  it('holds back a player who never saw it, even with a prediction validated', async () => {
    const ada = await t.signUp();
    await validateQualifiers(ada);
    await t.prisma.user.updateMany({ data: { onboardingVersionSeen: 0 } });

    expect(await states(ada)).toMatchObject({ PRESENTATION: 'TODO', QUALIFIERS: 'UPCOMING' });
    await ada.post(ONBOARDING).expect(200);
    expect(await states(ada)).toMatchObject({ PRESENTATION: 'DONE', QUALIFIERS: 'DONE' });
  });

  it('only proposes a new version: any version seen, even the first, blocks nothing', async () => {
    const ada = await t.signUp();
    await validateQualifiers(ada);
    // The oldest version: after a bump of ONBOARDING_VERSION, players keep theirs.
    await t.prisma.user.updateMany({ data: { onboardingVersionSeen: 1 } });

    expect(await states(ada)).toMatchObject({
      PRESENTATION: 'DONE',
      QUALIFIERS: 'DONE',
      WINNER: 'UPCOMING',
      FIRST_ROUND: 'TODO',
    });
  });

  it('never lowers the version seen', async () => {
    const ada = await t.signUp();
    await t.prisma.user.updateMany({ data: { onboardingVersionSeen: ONBOARDING_VERSION + 1 } });
    const res = await ada.post(ONBOARDING).expect(200);
    expect(res.body.onboardingVersionSeen).toBe(ONBOARDING_VERSION + 1);
  });

  it('requires a signed-in player', async () => {
    await t.http().post(ONBOARDING).expect(401);
  });
});
