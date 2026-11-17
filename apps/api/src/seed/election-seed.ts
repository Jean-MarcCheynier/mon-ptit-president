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
      // The president elected at the second round, a candidate's slug; null until known.
      electedSlug: slugSchema.nullable().default(null),
    }),
    // The winner's prediction (docs/adr/0003), in display order: a candidate's slug, or null for
    // "autre candidat", with its odds. Empty: the phase isn't set up, players go through it.
    favorites: z
      .array(z.object({ slug: slugSchema.nullable(), odds: z.int().positive() }))
      .default([]),
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
  .superRefine(({ election, candidates, favorites }, ctx) => {
    const slugs = new Set(candidates.map((c) => c.slug));
    if (election.electedSlug !== null && !slugs.has(election.electedSlug)) {
      ctx.addIssue({
        code: 'custom',
        path: ['election', 'electedSlug'],
        message: 'Not a candidate of the file',
      });
    }
    const seen = new Set<string | null>();
    favorites.forEach(({ slug }, index) => {
      const message = seen.has(slug)
        ? 'Listed twice'
        : slug !== null && !slugs.has(slug)
          ? 'Not a candidate of the file'
          : null;
      if (message) ctx.addIssue({ code: 'custom', path: ['favorites', index, 'slug'], message });
      seen.add(slug);
    });

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
 * Upserts an election, its candidates and its favorites. Idempotent: running it twice changes
 * nothing, and edited fields are updated. Candidates and favorites missing from the file are left
 * untouched (they may already have predictions); mark candidates WITHDRAWN instead.
 * The input is validated at runtime: JSON imports are not typed precisely enough.
 */
export async function seedElection(prisma: PrismaClient, input: unknown) {
  const { election, candidates, favorites } = electionSeedSchema.parse(input);
  const { slug, electedSlug, ...electionFields } = election;

  const { id: electionId } = await prisma.election.upsert({
    where: { slug },
    create: { slug, ...electionFields },
    update: electionFields,
  });
  const politicianIds = new Map<string, string>();

  for (const { slug: politicianSlug, name, photoUrl, photoCredit, ...candidacy } of candidates) {
    const politician = { name, photoUrl, photoCredit };
    const { id: politicianId } = await prisma.politician.upsert({
      where: { slug: politicianSlug },
      create: { slug: politicianSlug, ...politician },
      update: politician,
    });
    politicianIds.set(politicianSlug, politicianId);
    const { source: _source, ...candidacyFields } = candidacy;
    await prisma.electionCandidate.upsert({
      where: { electionId_politicianId: { electionId, politicianId } },
      create: { electionId, politicianId, ...candidacyFields },
      update: candidacyFields,
    });
  }

  const idOf = (slug: string) => politicianIds.get(slug) ?? null;
  await prisma.election.update({
    where: { id: electionId },
    data: { electedPoliticianId: electedSlug && idOf(electedSlug) },
  });

  for (const [position, { slug: favoriteSlug, odds }] of favorites.entries()) {
    const politicianId = favoriteSlug && idOf(favoriteSlug);
    // A null politician can't be an upsert key: "autre candidat" is looked up by hand.
    const existing = await prisma.favorite.findFirst({
      where: { electionId, politicianId },
      select: { id: true },
    });
    if (existing) {
      await prisma.favorite.update({ where: { id: existing.id }, data: { odds, position } });
    } else {
      await prisma.favorite.create({ data: { electionId, politicianId, odds, position } });
    }
  }

  return { electionId, candidates: candidates.length, favorites: favorites.length };
}
