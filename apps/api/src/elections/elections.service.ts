import { HttpStatus, Injectable } from '@nestjs/common';
import { type CurrentElectionDto, ErrorCode } from '@presidency-bingo/shared';
import { ApiException } from '../common/api.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ElectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Id of the current election (see `getCurrent`). */
  async getCurrentId(now = new Date()): Promise<string> {
    const election = await this.prisma.election.findFirst({
      ...currentElection(now),
      select: { id: true },
    });
    if (!election) throw noCurrentElection();
    return election.id;
  }

  /** The next election whose second round hasn't passed yet. */
  async getCurrent(now = new Date()): Promise<CurrentElectionDto> {
    const election = await this.prisma.election.findFirst({
      ...currentElection(now),
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

const currentElection = (now: Date) =>
  ({
    where: { secondRoundAt: { gte: now } },
    orderBy: { firstRoundAt: 'asc' },
  }) as const;

const noCurrentElection = () =>
  new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NO_CURRENT_ELECTION, 'No upcoming election');
