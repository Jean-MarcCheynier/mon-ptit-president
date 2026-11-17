import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode, type FavoriteDto } from '@presidency-bingo/shared';
import { ApiException } from '../common/api.exception.js';
import { ElectionsService } from '../elections/elections.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { scoreWinner } from '../results/points.js';
import { ballotIncomplete, lockUserDraft } from './ballots.service.js';

const PHASE = 'WINNER';

export interface ValidatedWinner {
  validatedAt: Date;
  favoriteId: string;
}

/**
 * The user's winner's predictions (docs/adr/0003): a choice among the current election's
 * favorites, kept on the ballot row (`favoriteId`, no entries). Same draft / validated cycle and
 * locking as `BallotsService`; writes are refused while the phase isn't open to the user.
 */
@Injectable()
export class WinnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly elections: ElectionsService,
  ) {}

  /** The current election's favorites, in display order. */
  async getFavorites(): Promise<FavoriteDto[]> {
    const electionId = await this.elections.getCurrentId();
    return this.prisma.favorite.findMany({
      where: { electionId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        odds: true,
        politician: { select: { id: true, name: true, photoUrl: true, photoCredit: true } },
      },
    });
  }

  /** The draft's choice; null without a draft or before any choice. */
  async getDraft(userId: string): Promise<string | null> {
    const electionId = await this.elections.getCurrentId();
    const draft = await this.prisma.ballot.findFirst({
      where: { userId, electionId, phase: PHASE, status: 'DRAFT' },
      select: { favoriteId: true },
    });
    return draft?.favoriteId ?? null;
  }

  /** The latest validated prediction, and its points once the president is elected. */
  async getCurrent(
    userId: string,
  ): Promise<{ ballot: ValidatedWinner | null; points: number | null }> {
    const electionId = await this.elections.getCurrentId();
    const [ballot, election] = await Promise.all([
      this.prisma.ballot.findFirst({
        where: { userId, electionId, phase: PHASE, status: 'VALIDATED' },
        orderBy: { validatedAt: 'desc' },
        select: {
          validatedAt: true,
          favorite: { select: { id: true, politicianId: true, odds: true } },
        },
      }),
      this.prisma.election.findUniqueOrThrow({
        where: { id: electionId },
        select: { electedPoliticianId: true, favorites: { select: { politicianId: true } } },
      }),
    ]);
    // A validated winner's prediction always has a choice (CHECK "ballots_favorite_winner_only").
    if (!ballot?.favorite) return { ballot: null, points: null };

    const { electedPoliticianId: elected } = election;
    const favorites = new Set(election.favorites.flatMap((f) => f.politicianId ?? []));
    return {
      ballot: { validatedAt: ballot.validatedAt ?? new Date(0), favoriteId: ballot.favorite.id },
      points: elected === null ? null : scoreWinner(ballot.favorite, elected, favorites),
    };
  }

  /** Records the choice in the draft, creating it if needed. */
  async choose(userId: string, favoriteId: string): Promise<string> {
    const electionId = await this.elections.getOpenId(userId, PHASE);
    const favorite = await this.prisma.favorite.findFirst({
      where: { id: favoriteId, electionId },
      select: { id: true },
    });
    if (!favorite) throw unknownFavorite();

    // Retries if the draft got validated in between: the update only touches a draft (the
    // condition is rechecked once validation's lock is released), and the next draft is new.
    for (;;) {
      const ballotId = await this.findOrCreateDraft(userId, electionId);
      const { count } = await this.prisma.ballot.updateMany({
        where: { id: ballotId, status: 'DRAFT' },
        data: { favoriteId },
      });
      if (count > 0) return favoriteId;
    }
  }

  /** Freezes the draft into the prediction that counts; it must hold a choice. */
  async validate(userId: string): Promise<ValidatedWinner> {
    const electionId = await this.elections.getOpenId(userId, PHASE);
    return this.prisma.$transaction(async (tx) => {
      const ballotId = await lockUserDraft(tx, userId, electionId, PHASE, 'UPDATE');
      if (!ballotId) throw ballotIncomplete();
      const { favoriteId } = await tx.ballot.findUniqueOrThrow({
        where: { id: ballotId },
        select: { favoriteId: true },
      });
      if (!favoriteId) throw ballotIncomplete();

      const ballot = await tx.ballot.update({
        where: { id: ballotId },
        data: { status: 'VALIDATED', validatedAt: new Date() },
        select: { validatedAt: true },
      });
      return { validatedAt: ballot.validatedAt ?? new Date(0), favoriteId };
    });
  }

  /** The draft's id. A new draft starts from the current choice. */
  private async findOrCreateDraft(userId: string, electionId: string): Promise<string> {
    const where = { userId, electionId, phase: PHASE, status: 'DRAFT' } as const;
    const existing = await this.prisma.ballot.findFirst({ where, select: { id: true } });
    if (existing) return existing.id;

    const current = await this.prisma.ballot.findFirst({
      where: { userId, electionId, phase: PHASE, status: 'VALIDATED' },
      orderBy: { validatedAt: 'desc' },
      select: { favoriteId: true },
    });
    try {
      const created = await this.prisma.ballot.create({
        data: { userId, electionId, phase: PHASE, favoriteId: current?.favoriteId ?? null },
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

export const unknownFavorite = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    ErrorCode.UNKNOWN_FAVORITE,
    'Not a favorite of the current election',
  );
