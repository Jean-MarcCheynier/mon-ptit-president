import { Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type CurrentScoresDto,
  type ScoreDraftDto,
  type ScoreEntryDto,
  type ScoreEntryInput,
  scoreEntryInputSchema,
  type ValidatedScoresDto,
} from '@presidency-bingo/shared';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators.js';
import { ZodBody } from '../common/zod-body.decorator.js';
import { politicianIdPipe } from './ballots.controller.js';
import { BallotsService, type EntryRow, type ValidatedBallot } from './ballots.service.js';

const PHASE = 'FIRST_ROUND';

/**
 * The first-round prediction: a score per qualified candidate, in tenths of a point, 0 by default;
 * the sum is free. Open from the publication of the official list until the phase's closing.
 */
@ApiTags('ballots')
@Controller('elections/current/first-round')
export class FirstRoundController {
  constructor(private readonly ballots: BallotsService) {}

  @Get('ballot')
  async current(@CurrentUser() user: AuthUser): Promise<CurrentScoresDto> {
    const ballot = await this.ballots.getCurrent(user.id, PHASE);
    return { ballot: ballot && toValidatedDto(ballot) };
  }

  @Get('draft')
  async draft(@CurrentUser() user: AuthUser): Promise<ScoreDraftDto> {
    return { entries: (await this.ballots.getDraft(user.id, PHASE)).map(toEntryDto) };
  }

  @Post('draft')
  @HttpCode(200)
  async startDraft(@CurrentUser() user: AuthUser): Promise<ScoreDraftDto> {
    return { entries: (await this.ballots.startDraft(user.id, PHASE)).map(toEntryDto) };
  }

  @Post('draft/validate')
  @HttpCode(200)
  async validate(@CurrentUser() user: AuthUser): Promise<ValidatedScoresDto> {
    return toValidatedDto(await this.ballots.validate(user.id, PHASE));
  }

  @Put('draft/entries/:politicianId')
  async setEntry(
    @CurrentUser() user: AuthUser,
    @Param('politicianId', politicianIdPipe) politicianId: string,
    @ZodBody(scoreEntryInputSchema) body: ScoreEntryInput,
  ): Promise<ScoreEntryDto> {
    return toEntryDto(await this.ballots.setEntry(user.id, PHASE, politicianId, body));
  }

  @Delete('draft/entries/:politicianId')
  @HttpCode(204)
  removeEntry(
    @CurrentUser() user: AuthUser,
    @Param('politicianId', politicianIdPipe) politicianId: string,
  ): Promise<void> {
    return this.ballots.removeEntry(user.id, PHASE, politicianId);
  }
}

// Round lines always have a score (CHECK "ballot_entries_one_value").
const toEntryDto = ({ politicianId, score }: EntryRow): ScoreEntryDto => ({
  politicianId,
  score: score ?? 0,
});

const toValidatedDto = (ballot: ValidatedBallot): ValidatedScoresDto => ({
  validatedAt: ballot.validatedAt.toISOString(),
  entries: ballot.entries.map(toEntryDto),
});
