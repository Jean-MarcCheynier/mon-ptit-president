import { Controller, Delete, Get, HttpCode, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type CurrentWinnerDto,
  type FavoritesDto,
  type ValidatedWinnerDto,
  type WinnerChoiceInput,
  type WinnerDraftDto,
  winnerChoiceInputSchema,
} from '@presidency-bingo/shared';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators.js';
import { ZodBody } from '../common/zod-body.decorator.js';
import { BallotsService } from './ballots.service.js';
import { type ValidatedWinner, WinnerService } from './winner.service.js';

/**
 * The winner's prediction (docs/adr/0003): one favorite, or "autre candidat", each with fixed
 * odds. Open once the user cleared the qualifiers (docs/adr/0002), until `predictionsLockAt`.
 */
@ApiTags('ballots')
@Controller('elections/current/winner')
export class WinnerController {
  constructor(
    private readonly winner: WinnerService,
    private readonly ballots: BallotsService,
  ) {}

  @Get('favorites')
  async favorites(): Promise<FavoritesDto> {
    return { favorites: await this.winner.getFavorites() };
  }

  @Get('ballot')
  async current(@CurrentUser() user: AuthUser): Promise<CurrentWinnerDto> {
    const { ballot, points } = await this.winner.getCurrent(user.id);
    return { ballot: ballot && toValidatedDto(ballot), points };
  }

  @Get('draft')
  async draft(@CurrentUser() user: AuthUser): Promise<WinnerDraftDto> {
    return { favoriteId: await this.winner.getDraft(user.id) };
  }

  @Put('draft')
  async choose(
    @CurrentUser() user: AuthUser,
    @ZodBody(winnerChoiceInputSchema) body: WinnerChoiceInput,
  ): Promise<WinnerDraftDto> {
    return { favoriteId: await this.winner.choose(user.id, body.favoriteId) };
  }

  /** Drops the draft: the validated choice counts again. */
  @Delete('draft')
  @HttpCode(204)
  discardDraft(@CurrentUser() user: AuthUser): Promise<void> {
    return this.ballots.discardDraft(user.id, 'WINNER');
  }

  @Post('draft/validate')
  @HttpCode(200)
  async validate(@CurrentUser() user: AuthUser): Promise<ValidatedWinnerDto> {
    return toValidatedDto(await this.winner.validate(user.id));
  }
}

const toValidatedDto = (ballot: ValidatedWinner): ValidatedWinnerDto => ({
  validatedAt: ballot.validatedAt.toISOString(),
  favoriteId: ballot.favoriteId,
});
