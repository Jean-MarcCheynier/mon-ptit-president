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
import { BallotsService, unknownCandidate } from './ballots.service.js';

const politicianIdPipe = new ParseUUIDPipe({ exceptionFactory: unknownCandidate });

@ApiTags('ballots')
@Controller('elections/current')
export class BallotsController {
  constructor(private readonly ballots: BallotsService) {}

  @Get('ballot')
  current(@CurrentUser() user: AuthUser): Promise<CurrentBallotDto> {
    return this.ballots.getCurrent(user.id);
  }

  @Get('draft')
  draft(@CurrentUser() user: AuthUser): Promise<DraftBallotDto> {
    return this.ballots.getDraft(user.id);
  }

  @Post('draft')
  @HttpCode(200)
  startDraft(@CurrentUser() user: AuthUser): Promise<DraftBallotDto> {
    return this.ballots.startDraft(user.id);
  }

  @Post('draft/validate')
  @HttpCode(200)
  validate(@CurrentUser() user: AuthUser): Promise<ValidatedBallotDto> {
    return this.ballots.validate(user.id);
  }

  @Put('draft/entries/:politicianId')
  setEntry(
    @CurrentUser() user: AuthUser,
    @Param('politicianId', politicianIdPipe) politicianId: string,
    @ZodBody(ballotEntryInputSchema) body: BallotEntryInput,
  ): Promise<BallotEntryDto> {
    return this.ballots.setEntry(user.id, politicianId, body.isCandidate);
  }

  @Delete('draft/entries/:politicianId')
  @HttpCode(204)
  removeEntry(
    @CurrentUser() user: AuthUser,
    @Param('politicianId', politicianIdPipe) politicianId: string,
  ): Promise<void> {
    return this.ballots.removeEntry(user.id, politicianId);
  }
}
