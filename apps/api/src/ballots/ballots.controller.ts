import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type BallotEntryDto,
  type BallotEntryInput,
  ballotEntryInputSchema,
  type DraftBallotDto,
} from '@presidency-bingo/shared';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators.js';
import { ZodBody } from '../common/zod-body.decorator.js';
import { BallotsService, unknownCandidate } from './ballots.service.js';

const politicianIdPipe = new ParseUUIDPipe({ exceptionFactory: unknownCandidate });

@ApiTags('ballots')
@Controller('elections/current/draft')
export class BallotsController {
  constructor(private readonly ballots: BallotsService) {}

  @Get()
  draft(@CurrentUser() user: AuthUser): Promise<DraftBallotDto> {
    return this.ballots.getDraft(user.id);
  }

  @Put('entries/:politicianId')
  setEntry(
    @CurrentUser() user: AuthUser,
    @Param('politicianId', politicianIdPipe) politicianId: string,
    @ZodBody(ballotEntryInputSchema) body: BallotEntryInput,
  ): Promise<BallotEntryDto> {
    return this.ballots.setEntry(user.id, politicianId, body.isCandidate);
  }

  @Delete('entries/:politicianId')
  @HttpCode(204)
  removeEntry(
    @CurrentUser() user: AuthUser,
    @Param('politicianId', politicianIdPipe) politicianId: string,
  ): Promise<void> {
    return this.ballots.removeEntry(user.id, politicianId);
  }
}
