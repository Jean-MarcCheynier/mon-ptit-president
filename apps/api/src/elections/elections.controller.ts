import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CurrentElectionDto, PlayerPhasesDto } from '@presidency-bingo/shared';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators.js';
import { ElectionsService } from './elections.service.js';

@ApiTags('elections')
@Controller('elections')
export class ElectionsController {
  constructor(private readonly elections: ElectionsService) {}

  @Get('current')
  current(): Promise<CurrentElectionDto> {
    return this.elections.getCurrent();
  }

  /** The connected player's phases of the current election, with their states. */
  @Get('current/phases')
  async phases(@CurrentUser() user: AuthUser): Promise<PlayerPhasesDto> {
    return { phases: await this.elections.getPhases(user.id) };
  }
}
