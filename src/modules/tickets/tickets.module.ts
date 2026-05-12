import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { SlaModule } from '../sla/sla.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EscalationsModule } from '../escalations/escalations.module';
import { AiModule } from '../ai/ai.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { EmailListener } from './listeners/email.listener';
import { NotificationListener } from './listeners/notification.listener';
import { SocketListener } from './listeners/socket.listener';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [SlaModule, SystemSettingsModule, NotificationsModule, EscalationsModule, AiModule, RealtimeModule, AuditLogsModule],
  providers: [TicketsService, EmailListener, NotificationListener, SocketListener, WhatsAppService],
  controllers: [TicketsController],
  exports: [TicketsService],
})
export class TicketsModule {}
