import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type CurrentElectionDto,
  ErrorCode,
  type Phase,
  type PlayerPhaseDto,
} from '@presidency-bingo/shared';
import { ApiException } from '../common/api.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isPast, type PlayerPhase, phaseScheduleSelect, playerPhases } from './phases.js';

@Injectable()
export class ElectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Id of the current election (see `getCurrent`). */
  async getCurrentId(): Promise<string> {
    const election = await this.prisma.election.findFirst({
      ...currentElection(),
      select: { id: true },
    });
    if (!election) throw noCurrentElection();
    return election.id;
  }

  /** The player's journey through the current election (see `playerPhases`). */
  async getPhases(userId: string): Promise<PlayerPhaseDto[]> {
    const { phases } = await this.journey(userId);
    return phases.map(({ closesAt, ...phase }) => ({
      ...phase,
      closesAt: closesAt?.toISOString() ?? null,
    }));
  }

  /**
   * Id of the current election, if the player can write their prediction of the phase: 403
   * PREDICTIONS_NOT_OPEN while the phase isn't reachable yet, PREDICTIONS_LOCKED once it is
   * closed.
   */
  async getOpenId(userId: string, phase: Phase): Promise<string> {
    const { id, phases } = await this.journey(userId);
    const state = phases.find((p) => p.phase === phase)?.state;
    if (state === 'CLOSED' || state === 'SKIPPED') throw predictionsLocked();
    if (state !== 'TODO' && state !== 'DONE') throw predictionsNotOpen();
    return id;
  }

  private async journey(userId: string): Promise<{ id: string; phases: PlayerPhase[] }> {
    const election = await this.prisma.election.findFirst({
      ...currentElection(),
      select: { id: true, ...phaseScheduleSelect },
    });
    if (!election) throw noCurrentElection();
    const validated = await this.prisma.ballot.findMany({
      where: { userId, electionId: election.id, status: 'VALIDATED' },
      distinct: ['phase'],
      select: { phase: true },
    });
    const phases = playerPhases(election, new Set(validated.map((b) => b.phase)));
    return { id: election.id, phases };
  }

  /** The current election, with whether its official list is published (results are shown). */
  async getCurrentPublication(): Promise<{ id: string; published: boolean }> {
    const election = await this.prisma.election.findFirst({
      ...currentElection(),
      select: { id: true, officialListPublishedAt: true },
    });
    if (!election) throw noCurrentElection();
    return { id: election.id, published: isPast(election.officialListPublishedAt) };
  }

  /** The next election whose second round hasn't passed yet. */
  async getCurrent(): Promise<CurrentElectionDto> {
    const election = await this.prisma.election.findFirst({
      ...currentElection(),
      include: {
        candidates: {
          where: { status: { not: 'WITHDRAWN' } },
          include: { politician: true },
          orderBy: { politician: { name: 'asc' } },
        },
      },
    });
    if (!election) throw noCurrentElection();

    return {
      id: election.id,
      slug: election.slug,
      name: election.name,
      firstRoundAt: election.firstRoundAt.toISOString(),
      secondRoundAt: election.secondRoundAt.toISOString(),
      predictionsLockAt: election.predictionsLockAt.toISOString(),
      predictionsLocked: isPast(election.predictionsLockAt),
      officialListPublishedAt: election.officialListPublishedAt?.toISOString() ?? null,
      officialListPublished: isPast(election.officialListPublishedAt),
      candidates: election.candidates.map(({ politician, ...candidate }) => ({
        politicianId: politician.id,
        name: politician.name,
        photoUrl: politician.photoUrl,
        photoCredit: politician.photoCredit,
        partyLabel: candidate.partyLabel,
        tagline: candidate.tagline,
        status: candidate.status,
      })),
    };
  }
}

const currentElection = (now = new Date()) =>
  ({
    where: { secondRoundAt: { gte: now } },
    orderBy: { firstRoundAt: 'asc' },
  }) as const;

const predictionsLocked = () =>
  new ApiException(
    HttpStatus.FORBIDDEN,
    ErrorCode.PREDICTIONS_LOCKED,
    'Predictions are closed for this phase',
  );

const predictionsNotOpen = () =>
  new ApiException(
    HttpStatus.FORBIDDEN,
    ErrorCode.PREDICTIONS_NOT_OPEN,
    'Predictions are not open yet for this phase',
  );

const noCurrentElection = () =>
  new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NO_CURRENT_ELECTION, 'No upcoming election');
