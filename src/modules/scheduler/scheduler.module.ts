import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SlaModule } from '../sla/sla.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiExtendedModule } from '../ai-extended/ai-extended.module';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Module({
  imports: [SlaModule, SystemSettingsModule, NotificationsModule, AiExtendedModule],
  providers: [SchedulerService, PrismaService],
})
export class SchedulerModule {}
