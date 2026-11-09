import { type CandidateStatus, ErrorCode } from '@presidency-bingo/shared';
import { type ElectionSeed, seedElection } from '../src/seed/election-seed.js';
import { createTestApp, type TestApp } from './test-app.js';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const candidate = (slug: string, status: CandidateStatus = 'POTENTIAL') => ({
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
  firstRoundAt: inDays(60),
  secondRoundAt: inDays(74),
  predictionsLockAt: inDays(30),
};

const open = {
  election,
  candidates: ['anne', 'bruno', 'chloe', 'david', 'emma'].map((slug) => candidate(slug)),
} satisfies ElectionSeed;

/** The official list: anne and bruno qualified, emma withdrew after the bets were validated. */
const official = (publishedAt = inDays(-1), extra: ReturnType<typeof candidate>[] = []) =>
  ({
    election: { ...election, predictionsLockAt: inDays(-10), officialListPublishedAt: publishedAt },
    candidates: [
      candidate('anne', 'QUALIFIED'),
      candidate('bruno', 'QUALIFIED'),
      candidate('chloe', 'NOT_QUALIFIED'),
      candidate('david', 'NOT_QUALIFIED'),
      candidate('emma', 'WITHDRAWN'),
      ...extra,
    ],
  }) satisfies ElectionSeed;

const DRAFT = '/api/elections/current/draft';
const RESULTS = '/api/elections/current/results';

type Agent = Awaited<ReturnType<TestApp['signUp']>>;

describe('Results (e2e)', () => {
  let t: TestApp;
  const id = async (slug: string) =>
    (await t.prisma.politician.findUniqueOrThrow({ where: { slug } })).id;

  /** Validates a bet; `kept` are the candidates decided "qualifié", the others "recalé". */
  const bet = async (agent: Agent, kept: string[], all = open.candidates.map((c) => c.slug)) => {
    for (const slug of all) {
      await agent
        .put(`${DRAFT}/entries/${await id(slug)}`)
        .send({ isCandidate: kept.includes(slug) })
        .expect(200);
    }
    await agent.post(`${DRAFT}/validate`).expect(200);
  };

  const player = (name: string) => t.signUp({ name, email: `${name.toLowerCase()}@example.com` });

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.app.close());
  beforeEach(async () => {
    await t.reset();
    await seedElection(t.prisma, open);
  });

  it('exposes nothing before the official list is published', async () => {
    const ada = await player('Ada');
    await bet(ada, ['anne', 'bruno']);

    expect((await ada.get(RESULTS).expect(200)).body).toEqual({ published: false, result: null });

    // A publication date in the future isn't published yet.
    await seedElection(t.prisma, official(inDays(1)));
    expect((await ada.get(RESULTS).expect(200)).body).toEqual({ published: false, result: null });
    const current = await ada.get('/api/elections/current').expect(200);
    expect(current.body.officialListPublished).toBe(false);
  });

  it('has no result for a player who never validated a bet', async () => {
    const ada = await player('Ada');
    await seedElection(t.prisma, official());
    expect((await ada.get(RESULTS).expect(200)).body).toEqual({ published: true, result: null });
  });

  it('scores the latest validated bet by rarity among the other players', async () => {
    const ada = await player('Ada');
    const bob = await player('Bob');
    const cy = await player('Cy');
    await bet(ada, ['anne', 'bruno']);
    await bet(bob, ['anne', 'bruno']); // replaced by the bet below: only the latest one counts
    await bob.post(DRAFT).expect(200);
    await bet(bob, ['anne', 'chloe']);
    await bet(cy, ['anne', 'chloe']);
    await seedElection(t.prisma, official());

    const res = await ada.get(RESULTS).expect(200);
    expect(res.body.published).toBe(true);
    // anne: unanimous → 1; bruno and chloe: alone against both others → 100 each;
    // david: unanimous → 1; emma withdrew, "recalé" is right, unanimous → 1.
    expect(res.body.result).toMatchObject({ correct: 5, decisions: 5, points: 203 });
    const byName = Object.fromEntries(
      res.body.result.entries.map((e: { name: string }) => [e.name, e]),
    );
    expect(byName.bruno).toMatchObject({
      isCandidate: true,
      qualified: true,
      agreement: 0,
      points: 100,
    });
    expect(byName.chloe).toMatchObject({ isCandidate: false, qualified: false, points: 100 });
    expect(byName.emma).toMatchObject({ isCandidate: false, qualified: false, points: 1 });

    const bobs = (await bob.get(RESULTS).expect(200)).body.result;
    // bruno and chloe wrong (chloe: Cy agrees, Ada doesn't); anne, david, emma unanimous.
    expect(bobs).toMatchObject({ correct: 3, decisions: 5, points: 3 });
    expect(bobs.entries.find((e: { name: string }) => e.name === 'chloe')).toMatchObject({
      isCandidate: true,
      agreement: 0.5,
      points: 0,
    });
  });

  it('leaves candidates never decided out of the result and of the shares', async () => {
    const ada = await player('Ada');
    const bob = await player('Bob');
    await bet(ada, ['anne', 'bruno']);
    // Added to the pool after Ada validated: only Bob decides on him.
    await seedElection(t.prisma, { ...open, candidates: [...open.candidates, candidate('felix')] });
    await bet(bob, ['anne', 'bruno', 'felix'], [...open.candidates.map((c) => c.slug), 'felix']);
    await seedElection(t.prisma, official(inDays(-1), [candidate('felix', 'QUALIFIED')]));

    const adas = (await ada.get(RESULTS).expect(200)).body.result;
    expect(adas.decisions).toBe(5);
    expect(adas.entries.map((e: { name: string }) => e.name)).not.toContain('felix');

    const bobs = (await bob.get(RESULTS).expect(200)).body.result;
    expect(bobs.decisions).toBe(6);
    // Nobody else decided on felix: worth 1, like a unanimous decision.
    expect(bobs.entries.find((e: { name: string }) => e.name === 'felix')).toMatchObject({
      agreement: null,
      points: 1,
    });
  });

  it('ignores the bets of unverified accounts', async () => {
    const ada = await player('Ada');
    await bet(ada, ['anne', 'bruno']);
    const ghost = await t.prisma.user.create({
      data: { email: 'ghost@example.com', name: 'Ghost' },
    });
    const electionId = (await t.prisma.election.findFirstOrThrow()).id;
    await t.prisma.ballot.create({
      data: {
        userId: ghost.id,
        electionId,
        phase: 'QUALIFIERS',
        status: 'VALIDATED',
        validatedAt: new Date(),
        entries: { create: [{ politicianId: await id('bruno'), isCandidate: false }] },
      },
    });
    await seedElection(t.prisma, official());

    const res = await ada.get(RESULTS).expect(200);
    const bruno = res.body.result.entries.find((e: { name: string }) => e.name === 'bruno');
    expect(bruno).toMatchObject({ agreement: null, points: 1 });
  });

  it('requires authentication', async () => {
    const res = await t.http().get(RESULTS).expect(401);
    expect(res.body.code).toBe(ErrorCode.UNAUTHENTICATED);
  });
});
