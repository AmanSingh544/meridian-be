import { Module } from '@nestjs/common';
import { AiExtendedController } from './ai-extended.controller';
import { AiExtendedService } from './ai-extended.service';
import { AiModule } from '../ai/ai.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Module({
  imports: [AiModule, SystemSettingsModule, NotificationsModule],
  controllers: [AiExtendedController],
  providers: [AiExtendedService, PrismaService],
  exports: [AiExtendedService],
})
export class AiExtendedModule {}
