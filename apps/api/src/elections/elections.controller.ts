import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CurrentElectionDto } from '@presidency-bingo/shared';
import { ElectionsService } from './elections.service.js';

@ApiTags('elections')
@Controller('elections')
export class ElectionsController {
  constructor(private readonly elections: ElectionsService) {}

  @Get('current')
  current(): Promise<CurrentElectionDto> {
    return this.elections.getCurrent();
  }
}
