import { Module } from '@nestjs/common';
import { SlaController } from './sla.controller';
import { SlaPolicyController } from './sla-policy.controller';
import { SlaService } from './sla.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EscalationsModule } from '../escalations/escalations.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [NotificationsModule, EscalationsModule, SystemSettingsModule],
  controllers: [SlaController, SlaPolicyController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}
