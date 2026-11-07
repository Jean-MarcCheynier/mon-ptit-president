import { HttpStatus, Injectable } from '@nestjs/common';
import { type CurrentElectionDto, ErrorCode, type Phase } from '@presidency-bingo/shared';
import { ApiException } from '../common/api.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isPast, phaseScheduleSelect, phaseStatus, phaseWindow } from './phases.js';

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

  /**
   * Id of the current election, if the phase's predictions are open: 403 before their opening
   * and once they are closed.
   */
  async getOpenId(phase: Phase): Promise<string> {
    const election = await this.prisma.election.findFirst({
      ...currentElection(),
      select: { id: true, ...phaseScheduleSelect },
    });
    if (!election) throw noCurrentElection();
    const status = phaseStatus(phaseWindow(election, phase));
    if (status === 'CLOSED') throw predictionsLocked();
    if (status === 'UPCOMING') throw predictionsNotOpen();
    return election.id;
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
    const firstRound = phaseWindow(election, 'FIRST_ROUND');

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
      firstRound: {
        opensAt: firstRound.opensAt?.toISOString() ?? null,
        closesAt: firstRound.closesAt?.toISOString() ?? null,
        status: phaseStatus(firstRound),
      },
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
