import { type CandidateStatus, ErrorCode } from '@presidency-bingo/shared';
import { type ElectionSeed, seedElection } from '../src/seed/election-seed.js';
import { createTestApp, type TestApp } from './test-app.js';

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();

type SeedCandidate = ElectionSeed['candidates'][number];

const candidate = (
  slug: string,
  name: string,
  status: CandidateStatus = 'POTENTIAL',
): SeedCandidate => ({
  slug,
  name,
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
    candidate('zoe-zed', 'Zoé Zed', 'DECLARED'),
    candidate('alain-alpha', 'Alain Alpha'),
    candidate('william-withdrawn', 'William Withdrawn', 'WITHDRAWN'),
  ],
} satisfies ElectionSeed;

describe('Elections (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.app.close());
  beforeEach(() => t.reset());

  describe('seed', () => {
    it('is idempotent and updates edited fields', async () => {
      await seedElection(t.prisma, fixture);
      await seedElection(t.prisma, fixture);
      expect(await t.prisma.election.count()).toBe(1);
      expect(await t.prisma.politician.count()).toBe(3);
      expect(await t.prisma.electionCandidate.count()).toBe(3);

      await seedElection(t.prisma, {
        ...fixture,
        candidates: fixture.candidates.map((c) =>
          c.slug === 'zoe-zed' ? { ...c, partyLabel: 'Nouveau parti', status: 'WITHDRAWN' } : c,
        ),
      } satisfies ElectionSeed);

      const updated = await t.prisma.electionCandidate.findFirstOrThrow({
        where: { politician: { slug: 'zoe-zed' } },
      });
      expect(updated).toMatchObject({ partyLabel: 'Nouveau parti', status: 'WITHDRAWN' });
      expect(await t.prisma.electionCandidate.count()).toBe(3);
    });

    it('publishes the official list idempotently, keeping withdrawn candidates', async () => {
      const published = {
        election: { ...fixture.election, officialListPublishedAt: inDays(-1) },
        candidates: [
          candidate('zoe-zed', 'Zoé Zed', 'QUALIFIED'),
          candidate('alain-alpha', 'Alain Alpha', 'NOT_QUALIFIED'),
          candidate('william-withdrawn', 'William Withdrawn', 'WITHDRAWN'),
        ],
      } satisfies ElectionSeed;
      await seedElection(t.prisma, fixture);
      await seedElection(t.prisma, published);
      await seedElection(t.prisma, published);

      const statuses = await t.prisma.electionCandidate.findMany({
        select: { status: true, politician: { select: { slug: true } } },
        orderBy: { politician: { slug: 'asc' } },
      });
      expect(statuses.map((c) => [c.politician.slug, c.status])).toEqual([
        ['alain-alpha', 'NOT_QUALIFIED'],
        ['william-withdrawn', 'WITHDRAWN'],
        ['zoe-zed', 'QUALIFIED'],
      ]);
      const election = await t.prisma.election.findFirstOrThrow();
      expect(election.officialListPublishedAt?.toISOString()).toBe(
        published.election.officialListPublishedAt,
      );
    });

    it('rejects official list statuses that contradict the publication date', async () => {
      await expect(
        seedElection(t.prisma, {
          ...fixture,
          candidates: [candidate('x', 'X', 'QUALIFIED')],
        }),
      ).rejects.toThrow(/not published yet/);
      await expect(
        seedElection(t.prisma, {
          election: { ...fixture.election, officialListPublishedAt: inDays(-1) },
          candidates: [candidate('x', 'X', 'DECLARED')],
        }),
      ).rejects.toThrow(/Official list published/);
    });

    it('rejects invalid data', async () => {
      await expect(
        seedElection(t.prisma, {
          ...fixture,
          candidates: [{ ...candidate('x', 'X'), status: 'ELECTED' }],
        }),
      ).rejects.toThrow();
    });
  });

  describe('GET /api/elections/current', () => {
    it('returns the upcoming election with its active pool, sorted by name', async () => {
      await seedElection(t.prisma, fixture);
      const agent = await t.signUp();

      const res = await agent.get('/api/elections/current').expect(200);
      expect(res.body).toMatchObject({
        slug: 'presidentielle-test',
        predictionsLockAt: fixture.election.predictionsLockAt,
        predictionsLocked: false,
        officialListPublishedAt: null,
        officialListPublished: false,
      });
      // Phase states are per player: see GET /api/elections/current/phases.
      expect(res.body).not.toHaveProperty('firstRound');
      expect(res.body.candidates.map((c: { name: string }) => c.name)).toEqual([
        'Alain Alpha',
        'Zoé Zed',
      ]);
      expect(res.body.candidates[1]).toMatchObject({
        status: 'DECLARED',
        partyLabel: 'Parti',
        photoUrl: null,
      });
    });

    it('ignores elections that are over', async () => {
      await seedElection(t.prisma, {
        ...fixture,
        election: {
          ...fixture.election,
          firstRoundAt: inDays(-30),
          secondRoundAt: inDays(-16),
          predictionsLockAt: inDays(-60),
        },
      } satisfies ElectionSeed);
      const agent = await t.signUp();

      const res = await agent.get('/api/elections/current').expect(404);
      expect(res.body.code).toBe(ErrorCode.NO_CURRENT_ELECTION);
    });

    it('requires authentication', async () => {
      await t.http().get('/api/elections/current').expect(401);
    });
  });
});
