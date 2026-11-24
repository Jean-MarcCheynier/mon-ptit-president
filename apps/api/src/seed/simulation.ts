import { CANDIDATE_STATUSES } from '@presidency-bingo/shared';
import { z } from 'zod';

const DATE_FIELDS = [
  'firstRoundAt',
  'secondRoundAt',
  'predictionsLockAt',
  'officialListPublishedAt',
  'firstRoundClosesAt',
  'firstRoundResultsAt',
] as const;

/** "+7d", "-2h", "+30m": relative to the moment the step is applied. */
const RELATIVE_DATE = /^([+-])(\d+)([dhm])$/;
const UNIT_MS = { d: 24 * 60 * 60 * 1000, h: 60 * 60 * 1000, m: 60 * 1000 } as const;

const dateSchema = z
  .string()
  .refine((value) => RELATIVE_DATE.test(value) || !Number.isNaN(Date.parse(value)), {
    message: 'An ISO date, or relative to now: "+7d", "-2h", "+30m"',
  })
  .nullable();

/**
 * A simulation step (`simulation/*.json`): what changes from the real seed to reach a stage of
 * the election. Everything is optional; the result goes through the seed's own validation.
 */
export const simulationStepSchema = z.strictObject({
  $comment: z.string().optional(),
  election: z
    .strictObject({
      name: z.string().min(1).optional(),
      ...Object.fromEntries(DATE_FIELDS.map((field) => [field, dateSchema.optional()])),
      firstRoundResultsFinal: z.boolean().optional(),
      electedSlug: z.string().nullable().optional(),
    })
    .optional(),
  /** Status of the candidates the step doesn't list, the withdrawn ones aside. */
  othersStatus: z.enum(CANDIDATE_STATUSES).optional(),
  /** By slug: their status, and real first-round score in % (two decimals). */
  candidates: z
    .record(
      z.string(),
      z.strictObject({
        status: z.enum(CANDIDATE_STATUSES).optional(),
        firstRoundScore: z.number().nullable().optional(),
      }),
    )
    .optional(),
});
export type SimulationStep = z.input<typeof simulationStepSchema>;

function resolveDate(value: string | null, now: Date): string | null {
  const match = value === null ? null : RELATIVE_DATE.exec(value);
  if (!match) return value;
  const [, sign, amount, unit] = match;
  const offset = Number(amount) * UNIT_MS[unit as keyof typeof UNIT_MS];
  return new Date(now.getTime() + (sign === '-' ? -offset : offset)).toISOString();
}

/** The shape of a seed file this module relies on; `seedElection` validates the rest. */
interface SeedFile {
  election: object;
  candidates: readonly { slug: string; status: string }[];
}

/** The real seed with a simulation step applied on top; to give to `seedElection`. */
export function applyStep<S extends SeedFile>(base: S, input: unknown, now = new Date()): S {
  const step = simulationStepSchema.parse(input);
  const election: Record<string, unknown> = { ...base.election };
  for (const [field, value] of Object.entries(step.election ?? {})) {
    if (value === undefined) continue;
    const isDate = (DATE_FIELDS as readonly string[]).includes(field);
    election[field] = isDate ? resolveDate(value as string | null, now) : value;
  }

  const overrides = step.candidates ?? {};
  const unknown = Object.keys(overrides).filter((slug) =>
    base.candidates.every((c) => c.slug !== slug),
  );
  if (unknown.length > 0) throw new Error(`Not candidates of the seed: ${unknown.join(', ')}`);

  const candidates = base.candidates.map((candidate) => {
    const override = overrides[candidate.slug];
    if (override) return { ...candidate, ...override };
    if (step.othersStatus && candidate.status !== 'WITHDRAWN') {
      return { ...candidate, status: step.othersStatus };
    }
    return candidate;
  });
  return { ...base, election, candidates };
}

/** Simulations rewrite the election: only on a database of this machine, never production. */
export function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
