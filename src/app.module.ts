import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { AiModule } from './modules/ai/ai.module';
import { AiExtendedModule } from './modules/ai-extended/ai-extended.module';
import { CommentsModule } from './modules/comments/comments.module';
import { HealthModule } from './modules/health/health.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { SlaModule } from './modules/sla/sla.module';
import { RoutingRulesModule } from './modules/routing-rules/routing-rules.module';
import { EscalationsModule } from './modules/escalations/escalations.module';
import { SkillsModule } from './modules/skills/skills.module';
import { WorkloadsModule } from './modules/workloads/workloads.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { RoadmapModule } from './modules/roadmap/roadmap.module';
import { UserPreferencesModule } from './modules/user-preferences/user-preferences.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { TeamModule } from './modules/team/team.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { AiCopilotModule } from './modules/ai-copilot/ai-copilot.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { RedisModule } from './shared/redis/redis.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1 minute
        limit: 100,
      },
      {
        name: 'long',
        ttl: 600000, // 10 minutes
        limit: 500,
      },
    ]),
    ScheduleModule.forRoot(),
    SchedulerModule,
    RedisModule,
    EmailModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    TicketsModule,
    AiModule,
    AiExtendedModule,
    CommentsModule,
    OrganizationsModule,
    HealthModule,
    AttachmentsModule,
    ProjectsModule,
    KnowledgeBaseModule,
    NotificationsModule,
    DashboardModule,
    AnalyticsModule,
    AuditLogsModule,
    SlaModule,
    RoutingRulesModule,
    EscalationsModule,
    SkillsModule,
    WorkloadsModule,
    DeliveryModule,
    OnboardingModule,
    RoadmapModule,
    UserPreferencesModule,
    SystemSettingsModule,
    TeamModule,
    RealtimeModule,
    AiCopilotModule,
    DocumentsModule,
    FeedbackModule,
  ],
})
export class AppModule {}
