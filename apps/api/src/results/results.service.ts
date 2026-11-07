import { Injectable } from '@nestjs/common';
import type { ResultDto, ResultsDto } from '@presidency-bingo/shared';
import { ElectionsService } from '../elections/elections.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { scoreDecisions, type Tally } from './points.js';

/**
 * Results of the qualifiers' bet, computed on read from the latest validated bet of each player
 * (nothing is stored while the scoring may still change). Nothing is exposed before the official
 * list is published.
 */
@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly elections: ElectionsService,
  ) {}

  async getResults(userId: string): Promise<ResultsDto> {
    const { id: electionId, published } = await this.elections.getCurrentPublication();
    if (!published) return { published: false, result: null };

    const bet = await this.prisma.ballot.findFirst({
      where: { userId, electionId, status: 'VALIDATED' },
      orderBy: { validatedAt: 'desc' },
      select: {
        entries: {
          select: {
            politicianId: true,
            isCandidate: true,
            politician: { select: { name: true, photoUrl: true } },
          },
          orderBy: { politician: { name: 'asc' } },
        },
      },
    });
    if (!bet) return { published: true, result: null };

    const [tallies, qualified] = await Promise.all([
      this.tallies(electionId),
      this.qualified(electionId),
    ]);
    const scored = scoreDecisions(bet.entries, tallies, qualified);
    const result: ResultDto = {
      correct: scored.filter((d) => d.correct).length,
      decisions: scored.length,
      points: Math.round(scored.reduce((sum, d) => sum + d.points, 0)),
      entries: scored.map(({ politician, correct: _correct, ...decision }) => ({
        ...decision,
        name: politician.name,
        photoUrl: politician.photoUrl,
        qualified: qualified.has(decision.politicianId),
        points: Math.round(decision.points),
      })),
    };
    return { published: true, result };
  }

  /** Decisions per candidate in the latest validated bet of every verified player. */
  private async tallies(electionId: string): Promise<Map<string, Tally>> {
    const rows = await this.prisma.$queryRaw<
      { politician_id: string; qualified: number; not_qualified: number }[]
    >`
      SELECT e.politician_id,
             COUNT(*) FILTER (WHERE e.is_candidate)::int AS qualified,
             COUNT(*) FILTER (WHERE NOT e.is_candidate)::int AS not_qualified
      FROM (
        SELECT DISTINCT ON (b.user_id) b.id
        FROM ballots b
        JOIN users u ON u.id = b.user_id
        WHERE b.election_id = ${electionId}::uuid
          AND b.status = 'VALIDATED'
          AND u.email_verified_at IS NOT NULL
        ORDER BY b.user_id, b.validated_at DESC
      ) latest
      JOIN ballot_entries e ON e.ballot_id = latest.id
      GROUP BY e.politician_id`;
    return new Map(
      rows.map((r) => [r.politician_id, { qualified: r.qualified, notQualified: r.not_qualified }]),
    );
  }

  private async qualified(electionId: string): Promise<Set<string>> {
    const candidates = await this.prisma.electionCandidate.findMany({
      where: { electionId, status: 'QUALIFIED' },
      select: { politicianId: true },
    });
    return new Set(candidates.map((c) => c.politicianId));
  }
}
