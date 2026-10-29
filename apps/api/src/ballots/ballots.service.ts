import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type BallotEntryDto,
  type CurrentBallotDto,
  type DraftBallotDto,
  ErrorCode,
  MIN_CANDIDATES,
  type ValidatedBallotDto,
} from '@presidency-bingo/shared';
import { ApiException } from '../common/api.exception.js';
import { ElectionsService } from '../elections/elections.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

const entrySelect = { politicianId: true, isCandidate: true } as const;
const entriesSelect = { select: entrySelect, orderBy: { createdAt: 'asc' } } as const;

/**
 * The user's ballots for the current election: at most one draft, plus the validated history.
 * Validated ballots are immutable: entry writes and validation lock the draft row, so an entry
 * can never land in a ballot that is being validated. Every write is refused once predictions
 * are locked.
 */
@Injectable()
export class BallotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly elections: ElectionsService,
  ) {}

  async getDraft(userId: string): Promise<DraftBallotDto> {
    const electionId = await this.elections.getCurrentId();
    const draft = await this.prisma.ballot.findFirst({
      where: { userId, electionId, status: 'DRAFT' },
      select: { entries: entriesSelect },
    });
    return { entries: draft?.entries ?? [] };
  }

  /** The latest validated ballot: the user's current bet. */
  async getCurrent(userId: string): Promise<CurrentBallotDto> {
    const electionId = await this.elections.getCurrentId();
    const ballot = await this.latestValidated(userId, electionId);
    return { ballot: ballot && toValidatedDto(ballot) };
  }

  /** Opens a draft to change the current bet, pre-filled from it. Returns the existing draft if any. */
  async startDraft(userId: string): Promise<DraftBallotDto> {
    const electionId = await this.elections.getOpenId();
    await this.findOrCreateDraft(userId, electionId);
    return this.getDraft(userId);
  }

  /** Records a decision, creating the draft on the first one. */
  async setEntry(
    userId: string,
    politicianId: string,
    isCandidate: boolean,
  ): Promise<BallotEntryDto> {
    const electionId = await this.elections.getOpenId();
    const pool = await this.activePool(electionId);
    if (!pool.has(politicianId)) throw unknownCandidate();

    // Retries if the draft got validated between finding and locking it: the next one is pre-filled.
    for (;;) {
      const ballotId = await this.findOrCreateDraft(userId, electionId, pool);
      const entry = await this.prisma.$transaction(async (tx) => {
        if (!(await lockDraft(tx, ballotId, 'SHARE'))) return null;
        return tx.ballotEntry.upsert({
          where: { ballotId_politicianId: { ballotId, politicianId } },
          create: { ballotId, politicianId, isCandidate },
          update: { isCandidate },
          select: entrySelect,
        });
      });
      if (entry) return entry;
    }
  }

  /** Undoes a decision. Idempotent: removing a missing entry is a no-op. */
  async removeEntry(userId: string, politicianId: string): Promise<void> {
    const electionId = await this.elections.getOpenId();
    await this.prisma.$transaction(async (tx) => {
      const ballotId = await lockUserDraft(tx, userId, electionId, 'SHARE');
      if (ballotId) await tx.ballotEntry.deleteMany({ where: { ballotId, politicianId } });
    });
  }

  /**
   * Freezes the draft into the user's current bet. Every active candidate must be decided and
   * at least MIN_CANDIDATES kept; decisions on withdrawn politicians are dropped.
   */
  async validate(userId: string): Promise<ValidatedBallotDto> {
    const electionId = await this.elections.getOpenId();
    const pool = await this.activePool(electionId);

    return this.prisma.$transaction(async (tx) => {
      const ballotId = await lockUserDraft(tx, userId, electionId, 'UPDATE');
      if (!ballotId) throw ballotIncomplete();
      const entries = await tx.ballotEntry.findMany({ where: { ballotId }, select: entrySelect });
      const decided = entries.filter((e) => pool.has(e.politicianId));
      if (decided.length < pool.size) throw ballotIncomplete();
      if (decided.filter((e) => e.isCandidate).length < MIN_CANDIDATES) throw tooFewCandidates();

      await tx.ballotEntry.deleteMany({
        where: { ballotId, politicianId: { notIn: [...pool] } },
      });
      const ballot = await tx.ballot.update({
        where: { id: ballotId },
        data: { status: 'VALIDATED', validatedAt: new Date() },
        select: { validatedAt: true, entries: entriesSelect },
      });
      return toValidatedDto(ballot);
    });
  }

  private async activePool(electionId: string): Promise<Set<string>> {
    const candidates = await this.prisma.electionCandidate.findMany({
      where: { electionId, status: { not: 'WITHDRAWN' } },
      select: { politicianId: true },
    });
    return new Set(candidates.map((c) => c.politicianId));
  }

  private latestValidated(userId: string, electionId: string) {
    return this.prisma.ballot.findFirst({
      where: { userId, electionId, status: 'VALIDATED' },
      orderBy: { validatedAt: 'desc' },
      select: { validatedAt: true, entries: entriesSelect },
    });
  }

  /** The draft's id. A new draft starts from the current bet, minus withdrawn candidates. */
  private async findOrCreateDraft(
    userId: string,
    electionId: string,
    pool?: Set<string>,
  ): Promise<string> {
    const where = { userId, electionId, status: 'DRAFT' } as const;
    const existing = await this.prisma.ballot.findFirst({ where, select: { id: true } });
    if (existing) return existing.id;

    const [current, active] = await Promise.all([
      this.latestValidated(userId, electionId),
      pool ?? this.activePool(electionId),
    ]);
    const entries = current?.entries.filter((e) => active.has(e.politicianId)) ?? [];
    try {
      const created = await this.prisma.ballot.create({
        data: { userId, electionId, entries: { create: entries } },
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
  mode: LockMode,
): Promise<string | undefined> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM ballots
    WHERE user_id = ${userId}::uuid AND election_id = ${electionId}::uuid AND status = 'DRAFT'
    FOR ${Prisma.raw(mode)}`;
  return rows[0]?.id;
}

function toValidatedDto(ballot: {
  validatedAt: Date | null;
  entries: BallotEntryDto[];
}): ValidatedBallotDto {
  return {
    validatedAt: (ballot.validatedAt ?? new Date(0)).toISOString(),
    entries: ballot.entries,
  };
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
