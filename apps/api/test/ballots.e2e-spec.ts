import { ErrorCode } from '@presidency-bingo/shared';
import { type ElectionSeed, seedElection } from '../src/seed/election-seed.js';
import { createTestApp, type TestApp } from './test-app.js';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const candidate = (slug: string, status: 'POTENTIAL' | 'WITHDRAWN' = 'POTENTIAL') => ({
  slug,
  name: slug,
  photoUrl: null,
  photoCredit: null,
  partyLabel: 'Parti',
  tagline: 'Fonction',
  status,
  source: 'test',
});

const fixture = {
  election: {
    slug: 'presidentielle-test',
    name: 'Présidentielle test',
    firstRoundAt: inDays(60),
    secondRoundAt: inDays(74),
    predictionsLockAt: inDays(30),
  },
  candidates: [
    candidate('anne'),
    candidate('bruno'),
    candidate('chloe'),
    candidate('david'),
    candidate('emma'),
    candidate('william', 'WITHDRAWN'),
  ],
} satisfies ElectionSeed;

const DRAFT = '/api/elections/current/draft';

describe('Draft ballot (e2e)', () => {
  let t: TestApp;
  let ids: Map<string, string>;
  const id = (slug: string) => ids.get(slug) ?? slug;
  /** Entry route for a seeded politician (any other string is used as is). */
  const entry = (slug: string) => `${DRAFT}/entries/${id(slug)}`;

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

  const draftCount = () => t.prisma.ballot.count({ where: { status: 'DRAFT' } });

  it('starts empty without creating a ballot', async () => {
    const agent = await t.signUp();
    const res = await agent.get(DRAFT).expect(200);
    expect(res.body).toEqual({ entries: [] });
    expect(await t.prisma.ballot.count()).toBe(0);
  });

  it('creates the draft on the first decision and keeps every decision', async () => {
    const agent = await t.signUp();
    const res = await agent.put(entry('anne')).send({ isCandidate: true }).expect(200);
    expect(res.body).toEqual({ politicianId: id('anne'), isCandidate: true });
    await agent.put(entry('bruno')).send({ isCandidate: false }).expect(200);

    const draft = await agent.get(DRAFT).expect(200);
    expect(draft.body.entries).toEqual([
      { politicianId: id('anne'), isCandidate: true },
      { politicianId: id('bruno'), isCandidate: false },
    ]);
    expect(await draftCount()).toBe(1);
  });

  it('updates an existing decision instead of duplicating it', async () => {
    const agent = await t.signUp();
    await agent.put(entry('anne')).send({ isCandidate: true }).expect(200);
    await agent.put(entry('anne')).send({ isCandidate: false }).expect(200);

    const draft = await agent.get(DRAFT).expect(200);
    expect(draft.body.entries).toEqual([{ politicianId: id('anne'), isCandidate: false }]);
  });

  it('undoes a decision, idempotently', async () => {
    const agent = await t.signUp();
    await agent.put(entry('anne')).send({ isCandidate: true }).expect(200);
    await agent.put(entry('bruno')).send({ isCandidate: true }).expect(200);

    await agent.delete(entry('bruno')).expect(204);
    await agent.delete(entry('bruno')).expect(204);

    const draft = await agent.get(DRAFT).expect(200);
    expect(draft.body.entries).toEqual([{ politicianId: id('anne'), isCandidate: true }]);
    expect(await t.prisma.ballotEntry.count()).toBe(1);
  });

  it('never creates two drafts under concurrent requests', async () => {
    const agent = await t.signUp();
    // Includes the same politician twice; kept under 10 requests (supertest listener limit).
    const slugs = ['anne', 'bruno', 'chloe', 'david', 'emma', 'anne', 'bruno', 'chloe'];
    await Promise.all(slugs.map((slug) => agent.put(entry(slug)).send({ isCandidate: true })));

    expect(await draftCount()).toBe(1);
    const draft = await agent.get(DRAFT).expect(200);
    expect(draft.body.entries).toHaveLength(5);
  });

  it('allows a new draft next to a validated ballot', async () => {
    const agent = await t.signUp();
    const [user, election] = await Promise.all([
      t.prisma.user.findFirstOrThrow(),
      t.prisma.election.findFirstOrThrow(),
    ]);
    await t.prisma.ballot.create({
      data: {
        userId: user.id,
        electionId: election.id,
        status: 'VALIDATED',
        validatedAt: new Date(),
      },
    });

    await agent.put(entry('anne')).send({ isCandidate: true }).expect(200);
    expect(await draftCount()).toBe(1);
    await expect(
      t.prisma.ballot.create({ data: { userId: user.id, electionId: election.id } }),
    ).rejects.toThrow();
  });

  it('keeps drafts private to each user', async () => {
    const ada = await t.signUp();
    await ada.put(entry('anne')).send({ isCandidate: true }).expect(200);

    const bob = await t.signUp({ email: 'bob@example.com', name: 'Bob' });
    const res = await bob.get(DRAFT).expect(200);
    expect(res.body).toEqual({ entries: [] });
    await bob.delete(entry('anne')).expect(204);
    expect(await t.prisma.ballotEntry.count()).toBe(1);
  });

  it('rejects politicians outside the active pool', async () => {
    const agent = await t.signUp();
    for (const path of [
      entry('william'),
      entry('0190b9a0-0000-7000-8000-000000000000'),
      entry('not-a-uuid'),
    ]) {
      const res = await agent.put(path).send({ isCandidate: true }).expect(404);
      expect(res.body.code).toBe(ErrorCode.UNKNOWN_CANDIDATE);
    }
    expect(await t.prisma.ballot.count()).toBe(0);
  });

  it('validates the body', async () => {
    const agent = await t.signUp();
    const res = await agent.put(entry('anne')).send({ isCandidate: 'yes' }).expect(400);
    expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('requires authentication', async () => {
    await t.http().get(DRAFT).expect(401);
    await t.http().put(entry('anne')).send({ isCandidate: true }).expect(401);
    await t.http().delete(entry('anne')).expect(401);
  });
});
