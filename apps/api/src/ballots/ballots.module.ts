import { Module } from '@nestjs/common';
import { ElectionsModule } from '../elections/elections.module.js';
import { BallotsController } from './ballots.controller.js';
import { BallotsService } from './ballots.service.js';
import { FirstRoundController } from './first-round.controller.js';
import { WinnerController } from './winner.controller.js';
import { WinnerService } from './winner.service.js';

@Module({
  imports: [ElectionsModule],
  controllers: [BallotsController, WinnerController, FirstRoundController],
  providers: [BallotsService, WinnerService],
})
export class BallotsModule {}
