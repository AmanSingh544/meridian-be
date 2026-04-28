import { Module } from '@nestjs/common';
import { SlaController } from './sla.controller';
import { SlaPolicyController } from './sla-policy.controller';
import { SlaService } from './sla.service';

@Module({
  controllers: [SlaController, SlaPolicyController],
  providers: [SlaService],
})
export class SlaModule {}
