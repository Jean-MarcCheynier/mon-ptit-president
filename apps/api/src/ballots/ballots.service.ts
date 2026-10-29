import { HttpStatus, Injectable } from '@nestjs/common';
import { type BallotEntryDto, type DraftBallotDto, ErrorCode } from '@presidency-bingo/shared';
import { ApiException } from '../common/api.exception.js';
import { ElectionsService } from '../elections/elections.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const entrySelect = { politicianId: true, isCandidate: true } as const;

/** The user's draft ballot for the current election. */
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
      select: { entries: { select: entrySelect, orderBy: { createdAt: 'asc' } } },
    });
    return { entries: draft?.entries ?? [] };
  }

  /** Records a decision, creating the draft on the first one. */
  async setEntry(
    userId: string,
    politicianId: string,
    isCandidate: boolean,
  ): Promise<BallotEntryDto> {
    const electionId = await this.elections.getCurrentId();
    const inPool = await this.prisma.electionCandidate.count({
      where: { electionId, politicianId, status: { not: 'WITHDRAWN' } },
    });
    if (!inPool) throw unknownCandidate();

    const ballotId = await this.findOrCreateDraft(userId, electionId);
    return this.prisma.ballotEntry.upsert({
      where: { ballotId_politicianId: { ballotId, politicianId } },
      create: { ballotId, politicianId, isCandidate },
      update: { isCandidate },
      select: entrySelect,
    });
  }

  /** Undoes a decision. Idempotent: removing a missing entry is a no-op. */
  async removeEntry(userId: string, politicianId: string): Promise<void> {
    const electionId = await this.elections.getCurrentId();
    await this.prisma.ballotEntry.deleteMany({
      where: { politicianId, ballot: { userId, electionId, status: 'DRAFT' } },
    });
  }

  private async findOrCreateDraft(userId: string, electionId: string): Promise<string> {
    const where = { userId, electionId, status: 'DRAFT' } as const;
    const existing = await this.prisma.ballot.findFirst({ where, select: { id: true } });
    if (existing) return existing.id;
    try {
      const created = await this.prisma.ballot.create({
        data: { userId, electionId },
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

export const unknownCandidate = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    ErrorCode.UNKNOWN_CANDIDATE,
    'Not a candidate of the current election',
  );
