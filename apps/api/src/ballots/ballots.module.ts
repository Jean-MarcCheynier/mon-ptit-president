import { Module } from '@nestjs/common';
import { ElectionsModule } from '../elections/elections.module.js';
import { BallotsController } from './ballots.controller.js';
import { BallotsService } from './ballots.service.js';

@Module({
  imports: [ElectionsModule],
  controllers: [BallotsController],
  providers: [BallotsService],
})
export class BallotsModule {}
