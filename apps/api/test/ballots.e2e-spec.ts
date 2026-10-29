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
const VALIDATE = `${DRAFT}/validate`;
const BALLOT = '/api/elections/current/ballot';

describe('Ballots (e2e)', () => {
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
    await t.http().post(DRAFT).expect(401);
    await t.http().post(VALIDATE).expect(401);
    await t.http().get(BALLOT).expect(401);
    await t.http().put(entry('anne')).send({ isCandidate: true }).expect(401);
    await t.http().delete(entry('anne')).expect(401);
  });

  describe('validation', () => {
    type Agent = Awaited<ReturnType<TestApp['signUp']>>;
    const ACTIVE = ['anne', 'bruno', 'chloe', 'david', 'emma'];

    /** Decides every active candidate, keeping `kept` as candidates. */
    const decideAll = async (agent: Agent, kept: string[]) => {
      for (const slug of ACTIVE) {
        await agent
          .put(entry(slug))
          .send({ isCandidate: kept.includes(slug) })
          .expect(200);
      }
    };
    const entriesOf = (kept: string[], slugs = ACTIVE) =>
      slugs.map((slug) => ({ politicianId: id(slug), isCandidate: kept.includes(slug) }));
    const byPolitician = (a: { politicianId: string }, b: { politicianId: string }) =>
      a.politicianId.localeCompare(b.politicianId);
    const sorted = <T extends { politicianId: string }>(entries: T[]) =>
      [...entries].sort(byPolitician);
    const validatedBallots = () =>
      t.prisma.ballot.findMany({
        where: { status: 'VALIDATED' },
        orderBy: { validatedAt: 'asc' },
        include: { entries: { select: { politicianId: true, isCandidate: true } } },
      });

    it('has no current bet before the first validation', async () => {
      const agent = await t.signUp();
      const res = await agent.get(BALLOT).expect(200);
      expect(res.body).toEqual({ ballot: null });
    });

    it('validates a complete draft into the current bet', async () => {
      const agent = await t.signUp();
      await decideAll(agent, ['anne', 'bruno']);

      const res = await agent.post(VALIDATE).expect(200);
      expect(sorted(res.body.entries)).toEqual(sorted(entriesOf(['anne', 'bruno'])));
      expect(new Date(res.body.validatedAt).getTime()).toBeLessThanOrEqual(Date.now());

      const current = await agent.get(BALLOT).expect(200);
      expect(current.body.ballot).toEqual(res.body);
      expect(await draftCount()).toBe(0);
      expect((await agent.get(DRAFT).expect(200)).body).toEqual({ entries: [] });
    });

    it('rejects a missing or incomplete draft', async () => {
      const agent = await t.signUp();
      let res = await agent.post(VALIDATE).expect(422);
      expect(res.body.code).toBe(ErrorCode.BALLOT_INCOMPLETE);

      await agent.put(entry('anne')).send({ isCandidate: true }).expect(200);
      await agent.put(entry('bruno')).send({ isCandidate: true }).expect(200);
      res = await agent.post(VALIDATE).expect(422);
      expect(res.body.code).toBe(ErrorCode.BALLOT_INCOMPLETE);
      expect(await draftCount()).toBe(1);
    });

    it('requires at least two candidates kept', async () => {
      const agent = await t.signUp();
      await decideAll(agent, ['anne']);
      const res = await agent.post(VALIDATE).expect(422);
      expect(res.body.code).toBe(ErrorCode.TOO_FEW_CANDIDATES);
      expect(await draftCount()).toBe(1);
    });

    it('ignores and drops decisions on withdrawn politicians', async () => {
      const agent = await t.signUp();
      await decideAll(agent, ['anne', 'bruno']);
      // Decided before withdrawing (the API refuses it now).
      const draft = await t.prisma.ballot.findFirstOrThrow({ where: { status: 'DRAFT' } });
      await t.prisma.ballotEntry.create({
        data: { ballotId: draft.id, politicianId: id('william'), isCandidate: true },
      });

      const res = await agent.post(VALIDATE).expect(200);
      expect(res.body.entries).toHaveLength(ACTIVE.length);
    });

    it('never changes a validated ballot', async () => {
      const agent = await t.signUp();
      await decideAll(agent, ['anne', 'bruno']);
      await agent.post(VALIDATE).expect(200);

      // Writes after validation go to a new draft, pre-filled from the bet.
      await agent.put(entry('anne')).send({ isCandidate: false }).expect(200);
      await agent.delete(entry('bruno')).expect(204);
      await agent.post(VALIDATE).expect(422);

      const [validated] = await validatedBallots();
      expect(sorted(validated?.entries ?? [])).toEqual(sorted(entriesOf(['anne', 'bruno'])));
      const current = await agent.get(BALLOT).expect(200);
      expect(sorted(current.body.ballot.entries)).toEqual(sorted(entriesOf(['anne', 'bruno'])));
    });

    it('keeps validated ballots intact under a concurrent validation and writes', async () => {
      const agent = await t.signUp();
      await decideAll(agent, ['anne', 'bruno', 'chloe']);
      await Promise.all([
        agent.post(VALIDATE),
        agent.put(entry('chloe')).send({ isCandidate: false }),
        agent.put(entry('david')).send({ isCandidate: true }),
        agent.delete(entry('emma')),
      ]);

      const ballots = await t.prisma.ballot.findMany({ include: { entries: true } });
      for (const ballot of ballots.filter((b) => b.status === 'VALIDATED')) {
        expect(ballot.entries).toHaveLength(ACTIVE.length);
        expect(ballot.entries.every((e) => e.updatedAt <= (ballot.validatedAt ?? 0))).toBe(true);
      }
    });

    it('edits the bet in a pre-filled draft and keeps the history', async () => {
      const agent = await t.signUp();
      await decideAll(agent, ['anne', 'bruno']);
      await agent.post(VALIDATE).expect(200);

      const started = await agent.post(DRAFT).expect(200);
      expect(sorted(started.body.entries)).toEqual(sorted(entriesOf(['anne', 'bruno'])));
      // Idempotent: a second call returns the same draft.
      await agent.post(DRAFT).expect(200);
      expect(await draftCount()).toBe(1);

      await agent.put(entry('bruno')).send({ isCandidate: false }).expect(200);
      await agent.put(entry('chloe')).send({ isCandidate: true }).expect(200);

      // Until it is validated, the bet is still the first ballot.
      let current = await agent.get(BALLOT).expect(200);
      expect(sorted(current.body.ballot.entries)).toEqual(sorted(entriesOf(['anne', 'bruno'])));

      await agent.post(VALIDATE).expect(200);
      current = await agent.get(BALLOT).expect(200);
      expect(sorted(current.body.ballot.entries)).toEqual(sorted(entriesOf(['anne', 'chloe'])));

      const [first, second] = await validatedBallots();
      expect(sorted(first?.entries ?? [])).toEqual(sorted(entriesOf(['anne', 'bruno'])));
      expect(sorted(second?.entries ?? [])).toEqual(sorted(entriesOf(['anne', 'chloe'])));
    });

    it('does not pre-fill withdrawn politicians', async () => {
      const agent = await t.signUp();
      await decideAll(agent, ['anne', 'bruno', 'chloe']);
      await agent.post(VALIDATE).expect(200);
      await t.prisma.electionCandidate.updateMany({
        where: { politicianId: id('chloe') },
        data: { status: 'WITHDRAWN' },
      });

      const started = await agent.post(DRAFT).expect(200);
      expect(sorted(started.body.entries)).toEqual(
        sorted(entriesOf(['anne', 'bruno'], ['anne', 'bruno', 'david', 'emma'])),
      );
      const [validated] = await validatedBallots();
      expect(validated?.entries).toHaveLength(ACTIVE.length);
    });

    it('keeps bets private to each user', async () => {
      const ada = await t.signUp();
      await decideAll(ada, ['anne', 'bruno']);
      await ada.post(VALIDATE).expect(200);

      const bob = await t.signUp({ email: 'bob@example.com', name: 'Bob' });
      expect((await bob.get(BALLOT).expect(200)).body).toEqual({ ballot: null });
      expect((await bob.post(DRAFT).expect(200)).body).toEqual({ entries: [] });
      await bob.post(VALIDATE).expect(422);
    });
  });
});
