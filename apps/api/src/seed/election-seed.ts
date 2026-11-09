import { CANDIDATE_STATUSES, type CandidateStatus } from '@presidency-bingo/shared';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';

const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const OFFICIAL_LIST_STATUSES: readonly CandidateStatus[] = ['QUALIFIED', 'NOT_QUALIFIED'];

export const electionSeedSchema = z
  .object({
    election: z.object({
      slug: slugSchema,
      name: z.string().min(1),
      firstRoundAt: z.coerce.date(),
      secondRoundAt: z.coerce.date(),
      predictionsLockAt: z.coerce.date(),
      // Null until the Constitutional Council publishes the official list.
      officialListPublishedAt: z.coerce.date().nullable().default(null),
      // Closing of the first-round predictions, which open at the official list's publication.
      firstRoundClosesAt: z.coerce.date().nullable().default(null),
    }),
    candidates: z.array(
      z.object({
        slug: slugSchema,
        name: z.string().min(1),
        photoUrl: z.url().nullable(),
        photoCredit: z.string().nullable(),
        partyLabel: z.string().min(1),
        tagline: z.string().min(1),
        status: z.enum(CANDIDATE_STATUSES),
        // Where the status comes from; documentation only, not stored.
        source: z.string().min(1),
      }),
    ),
  })
  // Once published, every candidate still running is QUALIFIED or NOT_QUALIFIED (WITHDRAWN stays
  // WITHDRAWN); before that, nobody is.
  .superRefine(({ election, candidates }, ctx) => {
    const published = election.officialListPublishedAt !== null;
    candidates.forEach((candidate, index) => {
      if (candidate.status === 'WITHDRAWN') return;
      if (OFFICIAL_LIST_STATUSES.includes(candidate.status) === published) return;
      ctx.addIssue({
        code: 'custom',
        path: ['candidates', index, 'status'],
        message: published
          ? 'Official list published: must be QUALIFIED, NOT_QUALIFIED or WITHDRAWN'
          : 'Official list not published yet: QUALIFIED and NOT_QUALIFIED are not allowed',
      });
    });
  });
export type ElectionSeed = z.input<typeof electionSeedSchema>;

/**
 * Upserts an election and its candidates. Idempotent: running it twice changes nothing,
 * and edited fields are updated. Candidates missing from the file are left untouched
 * (they may already have predictions); mark them WITHDRAWN instead.
 * The input is validated at runtime: JSON imports are not typed precisely enough.
 */
export async function seedElection(prisma: PrismaClient, input: unknown) {
  const { election, candidates } = electionSeedSchema.parse(input);
  const { slug, ...electionFields } = election;

  const { id: electionId } = await prisma.election.upsert({
    where: { slug },
    create: { slug, ...electionFields },
    update: electionFields,
  });

  for (const { slug: politicianSlug, name, photoUrl, photoCredit, ...candidacy } of candidates) {
    const politician = { name, photoUrl, photoCredit };
    const { id: politicianId } = await prisma.politician.upsert({
      where: { slug: politicianSlug },
      create: { slug: politicianSlug, ...politician },
      update: politician,
    });
    const { source: _source, ...candidacyFields } = candidacy;
    await prisma.electionCandidate.upsert({
      where: { electionId_politicianId: { electionId, politicianId } },
      create: { electionId, politicianId, ...candidacyFields },
      update: candidacyFields,
    });
  }

  return { electionId, candidates: candidates.length };
}
