import { HttpStatus, Injectable } from '@nestjs/common';
import { type CurrentElectionDto, ErrorCode } from '@presidency-bingo/shared';
import { ApiException } from '../common/api.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ElectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The next election whose second round hasn't passed yet. */
  async getCurrent(now = new Date()): Promise<CurrentElectionDto> {
    const election = await this.prisma.election.findFirst({
      where: { secondRoundAt: { gte: now } },
      orderBy: { firstRoundAt: 'asc' },
      include: {
        candidates: {
          where: { status: { not: 'WITHDRAWN' } },
          include: { politician: true },
          orderBy: { politician: { name: 'asc' } },
        },
      },
    });
    if (!election) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NO_CURRENT_ELECTION,
        'No upcoming election',
      );
    }

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
