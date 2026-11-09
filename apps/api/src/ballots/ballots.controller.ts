import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type BallotEntryDto,
  type BallotEntryInput,
  ballotEntryInputSchema,
  type CurrentBallotDto,
  type DraftBallotDto,
  type ValidatedBallotDto,
} from '@presidency-bingo/shared';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators.js';
import { ZodBody } from '../common/zod-body.decorator.js';
import {
  BallotsService,
  type EntryRow,
  unknownCandidate,
  type ValidatedBallot,
} from './ballots.service.js';

export const politicianIdPipe = new ParseUUIDPipe({ exceptionFactory: unknownCandidate });

const PHASE = 'QUALIFIERS';

/** The qualifiers' prediction: a "qualifié" / "recalé" decision per candidate of the pool. */
@ApiTags('ballots')
@Controller('elections/current')
export class BallotsController {
  constructor(private readonly ballots: BallotsService) {}

  @Get('ballot')
  async current(@CurrentUser() user: AuthUser): Promise<CurrentBallotDto> {
    const ballot = await this.ballots.getCurrent(user.id, PHASE);
    return { ballot: ballot && toValidatedDto(ballot) };
  }

  @Get('draft')
  async draft(@CurrentUser() user: AuthUser): Promise<DraftBallotDto> {
    return { entries: (await this.ballots.getDraft(user.id, PHASE)).map(toEntryDto) };
  }

  @Post('draft')
  @HttpCode(200)
  async startDraft(@CurrentUser() user: AuthUser): Promise<DraftBallotDto> {
    return { entries: (await this.ballots.startDraft(user.id, PHASE)).map(toEntryDto) };
  }

  @Post('draft/validate')
  @HttpCode(200)
  async validate(@CurrentUser() user: AuthUser): Promise<ValidatedBallotDto> {
    return toValidatedDto(await this.ballots.validate(user.id, PHASE));
  }

  @Put('draft/entries/:politicianId')
  async setEntry(
    @CurrentUser() user: AuthUser,
    @Param('politicianId', politicianIdPipe) politicianId: string,
    @ZodBody(ballotEntryInputSchema) body: BallotEntryInput,
  ): Promise<BallotEntryDto> {
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

// Qualifiers' lines always have isCandidate (CHECK "ballot_entries_one_value").
const toEntryDto = ({ politicianId, isCandidate }: EntryRow): BallotEntryDto => ({
  politicianId,
  isCandidate: isCandidate === true,
});

const toValidatedDto = (ballot: ValidatedBallot): ValidatedBallotDto => ({
  validatedAt: ballot.validatedAt.toISOString(),
  entries: ballot.entries.map(toEntryDto),
});
