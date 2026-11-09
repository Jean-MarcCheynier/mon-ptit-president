import { Module } from '@nestjs/common';
import { ElectionsModule } from '../elections/elections.module.js';
import { BallotsController } from './ballots.controller.js';
import { BallotsService } from './ballots.service.js';
import { FirstRoundController } from './first-round.controller.js';

@Module({
  imports: [ElectionsModule],
  controllers: [BallotsController, FirstRoundController],
  providers: [BallotsService],
})
export class BallotsModule {}
