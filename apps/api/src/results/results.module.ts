import { Module } from '@nestjs/common';
import { ElectionsModule } from '../elections/elections.module.js';
import { ResultsController } from './results.controller.js';
import { ResultsService } from './results.service.js';

@Module({
  imports: [ElectionsModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
