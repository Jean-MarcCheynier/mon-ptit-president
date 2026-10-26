import { Module } from '@nestjs/common';
import { ElectionsController } from './elections.controller.js';
import { ElectionsService } from './elections.service.js';

@Module({
  controllers: [ElectionsController],
  providers: [ElectionsService],
  exports: [ElectionsService],
})
export class ElectionsModule {}
