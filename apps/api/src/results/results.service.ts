import { Injectable } from '@nestjs/common';
import type { ResultDto, ResultsDto, RoundResultsDto } from '@presidency-bingo/shared';
import { ElectionsService } from '../elections/elections.service.js';
import { isPast } from '../elections/phases.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { scoreDecisions, scoreRound, type Tally } from './points.js';

/**
 * Results of the predictions, computed on read from the latest validated prediction of each player
 * (nothing is stored while the scoring or the real results may still change). Nothing of a phase
 * is exposed before its results are published: the official list for the qualifiers, the
 * round's results for the first round.
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
      where: { userId, electionId, phase: 'QUALIFIERS', status: 'VALIDATED' },
      orderBy: { validatedAt: 'desc' },
      select: {
        entries: {
          where: { isCandidate: { not: null } },
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
    const decisions = bet.entries.map((e) => ({ ...e, isCandidate: e.isCandidate === true }));
    const scored = scoreDecisions(decisions, tallies, qualified);
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

  /** The player's first-round prediction against the results, provisional or official. */
  async getFirstRoundResults(userId: string): Promise<RoundResultsDto> {
    const electionId = await this.elections.getCurrentId();
    const election = await this.prisma.election.findUniqueOrThrow({
      where: { id: electionId },
      select: {
        firstRoundResultsAt: true,
        firstRoundResultsFinal: true,
        // A qualified candidate who withdrew before the vote has no score: their lines are ignored.
        candidates: {
          where: { status: 'QUALIFIED', firstRoundScore: { not: null } },
          select: {
            politicianId: true,
            firstRoundScore: true,
            politician: { select: { name: true, photoUrl: true } },
          },
        },
      },
    });
    if (!isPast(election.firstRoundResultsAt)) {
      return { published: false, final: false, result: null };
    }
    const final = election.firstRoundResultsFinal;

    const ballot = await this.prisma.ballot.findFirst({
      where: { userId, electionId, phase: 'FIRST_ROUND', status: 'VALIDATED' },
      orderBy: { validatedAt: 'desc' },
      select: {
        entries: { where: { score: { not: null } }, select: { politicianId: true, score: true } },
      },
    });
    if (!ballot) return { published: true, final, result: null };

    const predicted = new Map(ballot.entries.map((e) => [e.politicianId, e.score ?? 0]));
    const actual = new Map(
      election.candidates.map((c) => [c.politicianId, c.firstRoundScore ?? 0]),
    );
    const politicians = new Map(election.candidates.map((c) => [c.politicianId, c.politician]));
    const scored = scoreRound(predicted, actual);
    return {
      published: true,
      final,
      result: {
        points: Math.round(scored.points),
        finalists: scored.finalists,
        bonus: scored.bonus,
        entries: scored.lines.map((line) => {
          const politician = politicians.get(line.politicianId);
          return {
            ...line,
            name: politician?.name ?? '',
            photoUrl: politician?.photoUrl ?? null,
            points: Math.round(line.points * 10) / 10,
          };
        }),
      },
    };
  }

  /** Decisions per candidate in the latest validated bet of every verified player. */
  private async tallies(electionId: string): Promise<Map<string, Tally>> {
    const rows = await this.prisma.$queryRaw<
      { politician_id: string; qualified: number; not_qualified: number }[]
    >`
      SELECT d.politician_id,
             COUNT(*) FILTER (WHERE d.is_candidate)::int AS qualified,
             COUNT(*) FILTER (WHERE NOT d.is_candidate)::int AS not_qualified
      FROM qualifier_decisions d
      JOIN users u ON u.id = d.user_id
      WHERE d.election_id = ${electionId}::uuid
        AND u.email_verified_at IS NOT NULL
      GROUP BY d.politician_id`;
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
