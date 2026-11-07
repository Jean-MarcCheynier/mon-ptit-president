import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { ResultsDto } from '@presidency-bingo/shared';
import { type AuthUser, CurrentUser } from '../auth/auth.decorators.js';
import { ResultsService } from './results.service.js';

@ApiTags('results')
@Controller('elections/current')
export class ResultsController {
  constructor(private readonly service: ResultsService) {}

  @Get('results')
  results(@CurrentUser() user: AuthUser): Promise<ResultsDto> {
    return this.service.getResults(user.id);
  }
}
