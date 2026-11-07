import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode, MIN_CANDIDATES, type Phase } from '@presidency-bingo/shared';
import { ApiException } from '../common/api.exception.js';
import { ElectionsService } from '../elections/elections.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

const entrySelect = { politicianId: true, isCandidate: true, score: true } as const;
const entriesSelect = { select: entrySelect, orderBy: { createdAt: 'asc' } } as const;

/** A ballot line as stored: `isCandidate` for the qualifiers, `score` for the rounds. */
export interface EntryRow {
  politicianId: string;
  isCandidate: boolean | null;
  score: number | null;
}

/** What a line says, matching its phase. */
export type EntryValue = { isCandidate: boolean } | { score: number };

export interface ValidatedBallot {
  validatedAt: Date;
  entries: EntryRow[];
}

/**
 * The user's ballots for one phase of the current election: at most one draft, plus the
 * validated history (docs/adr/0002). Validated ballots are immutable: entry writes and validation
 * lock the draft row, so an entry can never land in a ballot that is being validated. Every write
 * is refused outside the phase's opening and closing.
 */
@Injectable()
export class BallotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly elections: ElectionsService,
  ) {}

  async getDraft(userId: string, phase: Phase): Promise<EntryRow[]> {
    const electionId = await this.elections.getCurrentId();
    const draft = await this.prisma.ballot.findFirst({
      where: { userId, electionId, phase, status: 'DRAFT' },
      select: { entries: entriesSelect },
    });
    return draft?.entries ?? [];
  }

  /** The latest validated ballot: the one that counts. */
  async getCurrent(userId: string, phase: Phase): Promise<ValidatedBallot | null> {
    const electionId = await this.elections.getCurrentId();
    return this.latestValidated(userId, electionId, phase);
  }

  /** Opens a draft to change the current ballot, pre-filled from it. Returns the existing draft if any. */
  async startDraft(userId: string, phase: Phase): Promise<EntryRow[]> {
    const electionId = await this.elections.getOpenId(phase);
    await this.findOrCreateDraft(userId, electionId, phase);
    return this.getDraft(userId, phase);
  }

  /** Records a line, creating the draft on the first one. */
  async setEntry(
    userId: string,
    phase: Phase,
    politicianId: string,
    value: EntryValue,
  ): Promise<EntryRow> {
    const electionId = await this.elections.getOpenId(phase);
    const pool = await this.pool(electionId, phase);
    if (!pool.has(politicianId)) throw unknownCandidate();

    // Retries if the draft got validated between finding and locking it: the next one is pre-filled.
    for (;;) {
      const ballotId = await this.findOrCreateDraft(userId, electionId, phase, pool);
      const entry = await this.prisma.$transaction(async (tx) => {
        if (!(await lockDraft(tx, ballotId, 'SHARE'))) return null;
        return tx.ballotEntry.upsert({
          where: { ballotId_politicianId: { ballotId, politicianId } },
          create: { ballotId, politicianId, ...value },
          update: value,
          select: entrySelect,
        });
      });
      if (entry) return entry;
    }
  }

  /** Undoes a line. Idempotent: removing a missing entry is a no-op. */
  async removeEntry(userId: string, phase: Phase, politicianId: string): Promise<void> {
    const electionId = await this.elections.getOpenId(phase);
    await this.prisma.$transaction(async (tx) => {
      const ballotId = await lockUserDraft(tx, userId, electionId, phase, 'SHARE');
      if (ballotId) await tx.ballotEntry.deleteMany({ where: { ballotId, politicianId } });
    });
  }

  /**
   * Freezes the draft into the ballot that counts; lines on politicians who left the pool are
   * dropped. Qualifiers: every candidate must be decided (see `checkQualifiers`). Rounds: every
   * score defaults to 0 %, so a candidate without a line gets one at 0 and the sum is free
   * (docs/adr/0002); a round can be validated without any draft.
   */
  async validate(userId: string, phase: Phase): Promise<ValidatedBallot> {
    const electionId = await this.elections.getOpenId(phase);
    const pool = await this.pool(electionId, phase);
    const round = phase !== 'QUALIFIERS';
    if (round) await this.findOrCreateDraft(userId, electionId, phase, pool);

    return this.prisma.$transaction(async (tx) => {
      const ballotId = await lockUserDraft(tx, userId, electionId, phase, 'UPDATE');
      if (!ballotId) throw ballotIncomplete();
      const entries = await tx.ballotEntry.findMany({ where: { ballotId }, select: entrySelect });
      const inPool = entries.filter((e) => pool.has(e.politicianId));
      if (round) {
        const scored = new Set(inPool.map((e) => e.politicianId));
        await tx.ballotEntry.createMany({
          data: [...pool]
            .filter((politicianId) => !scored.has(politicianId))
            .map((politicianId) => ({ ballotId, politicianId, score: 0 })),
        });
      } else {
        checkQualifiers(inPool, pool);
      }

      await tx.ballotEntry.deleteMany({
        where: { ballotId, politicianId: { notIn: [...pool] } },
      });
      const ballot = await tx.ballot.update({
        where: { id: ballotId },
        data: { status: 'VALIDATED', validatedAt: new Date() },
        select: { validatedAt: true, entries: entriesSelect },
      });
      return { validatedAt: ballot.validatedAt ?? new Date(0), entries: ballot.entries };
    });
  }

  /**
   * The politicians a phase predicts on. Qualifiers: the active pool (every candidate except
   * WITHDRAWN); first round: the qualified candidates of the official list.
   */
  private async pool(electionId: string, phase: Phase): Promise<Set<string>> {
    const status = phase === 'QUALIFIERS' ? { not: 'WITHDRAWN' as const } : 'QUALIFIED';
    const candidates = await this.prisma.electionCandidate.findMany({
      where: { electionId, status },
      select: { politicianId: true },
    });
    return new Set(candidates.map((c) => c.politicianId));
  }

  private async latestValidated(
    userId: string,
    electionId: string,
    phase: Phase,
  ): Promise<ValidatedBallot | null> {
    const ballot = await this.prisma.ballot.findFirst({
      where: { userId, electionId, phase, status: 'VALIDATED' },
      orderBy: { validatedAt: 'desc' },
      select: { validatedAt: true, entries: entriesSelect },
    });
    return ballot && { validatedAt: ballot.validatedAt ?? new Date(0), entries: ballot.entries };
  }

  /** The draft's id. A new draft starts from the current ballot, minus politicians out of the pool. */
  private async findOrCreateDraft(
    userId: string,
    electionId: string,
    phase: Phase,
    pool?: Set<string>,
  ): Promise<string> {
    const where = { userId, electionId, phase, status: 'DRAFT' } as const;
    const existing = await this.prisma.ballot.findFirst({ where, select: { id: true } });
    if (existing) return existing.id;

    const [current, active] = await Promise.all([
      this.latestValidated(userId, electionId, phase),
      pool ?? this.pool(electionId, phase),
    ]);
    const entries = current?.entries.filter((e) => active.has(e.politicianId)) ?? [];
    try {
      const created = await this.prisma.ballot.create({
        data: { userId, electionId, phase, entries: { create: entries } },
        select: { id: true },
      });
      return created.id;
    } catch (error) {
      // A concurrent request won the race; the partial unique index kept a single draft.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const draft = await this.prisma.ballot.findFirstOrThrow({ where, select: { id: true } });
        return draft.id;
      }
      throw error;
    }
  }
}

/** Whether a qualifiers' draft can be validated: every candidate decided, at least MIN_CANDIDATES kept. */
function checkQualifiers(entries: EntryRow[], pool: Set<string>): void {
  if (entries.length < pool.size) throw ballotIncomplete();
  if (entries.filter((e) => e.isCandidate).length < MIN_CANDIDATES) throw tooFewCandidates();
}

type LockMode = 'SHARE' | 'UPDATE';

/** Locks the ballot if it is still a draft (rechecked after waiting for the lock). */
async function lockDraft(tx: Tx, ballotId: string, mode: LockMode): Promise<boolean> {
  const rows = await tx.$queryRaw<unknown[]>`
    SELECT id FROM ballots WHERE id = ${ballotId}::uuid AND status = 'DRAFT'
    FOR ${Prisma.raw(mode)}`;
  return rows.length > 0;
}

async function lockUserDraft(
  tx: Tx,
  userId: string,
  electionId: string,
  phase: Phase,
  mode: LockMode,
): Promise<string | undefined> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM ballots
    WHERE user_id = ${userId}::uuid AND election_id = ${electionId}::uuid
      AND phase = ${phase}::"BallotPhase" AND status = 'DRAFT'
    FOR ${Prisma.raw(mode)}`;
  return rows[0]?.id;
}

export const unknownCandidate = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    ErrorCode.UNKNOWN_CANDIDATE,
    'Not a candidate of the current election',
  );

const ballotIncomplete = () =>
  new ApiException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    ErrorCode.BALLOT_INCOMPLETE,
    'Every candidate must be decided before validating',
  );

const tooFewCandidates = () =>
  new ApiException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    ErrorCode.TOO_FEW_CANDIDATES,
    `At least ${MIN_CANDIDATES} candidates must be kept`,
  );
