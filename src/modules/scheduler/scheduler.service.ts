import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiExtendedService } from '../ai-extended/ai-extended.service';
import { SlaService } from '../sla/sla.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private systemSettingsService: SystemSettingsService,
    private notificationsService: NotificationsService,
    private aiExtendedService: AiExtendedService,
    private slaService: SlaService,
  ) {}

  // ── Daily Digest ──────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async dailyDigestCron() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      try {
        const settings = await this.systemSettingsService.getSettings(t.id);
        const { dailyDigestEnabled, dailyDigestTime } = (settings?.data as any)?.notifications ?? {};
        if (!dailyDigestEnabled || !dailyDigestTime) continue;

        const now = new Date();
        const [hh, mm] = (dailyDigestTime as string).split(':').map(Number);
        if (now.getHours() !== hh || now.getMinutes() !== mm) continue;

        const digest = await this.aiExtendedService.getDigest();
        await this.notificationsService.notifyAdmins(
          t.id,
          'daily_digest',
          'Daily Digest',
          (digest.data as any).digestSummary ?? '',
          { digest: digest.data },
        );
        this.logger.log(`Daily digest sent for tenant ${t.id}`);
      } catch (err: any) {
        this.logger.warn(`dailyDigestCron failed for tenant ${t.id}: ${err?.message}`);
      }
    }
  }

  // ── Weekly Project Summaries ──────────────────────────────────────────────

  @Cron('0 9 * * 1')
  async weeklyProjectSummaryCron() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      try {
        const settings = await this.systemSettingsService.getSettings(t.id);
        const weeklyEnabled = (settings?.data as any)?.aiFeatures?.weeklyProjectSummariesEnabled;
        if (!weeklyEnabled) continue;

        const projects = await this.prisma.project.findMany({
          where: { tenant_id: t.id, status: { not: 'archived' as any } },
          select: { id: true, name: true },
        });

        for (const p of projects) {
          try {
            const report = await this.aiExtendedService.getProjectStatusReport(p.id);
            await this.notificationsService.notifyAdmins(
              t.id,
              'weekly_project_summary',
              `Weekly Summary: ${p.name}`,
              (report.data as any)?.summary ?? '',
              { project_id: p.id },
            );
          } catch (err: any) {
            this.logger.warn(`weeklyProjectSummaryCron failed for project ${p.id}: ${err?.message}`);
          }
        }
        this.logger.log(`Weekly project summaries sent for tenant ${t.id}`);
      } catch (err: any) {
        this.logger.warn(`weeklyProjectSummaryCron failed for tenant ${t.id}: ${err?.message}`);
      }
    }
  }

  // ── S1 Re-Alert ───────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async s1ReAlertCron() {
    const now = new Date();
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });

    for (const t of tenants) {
      try {
        const slaPolicySample = await this.prisma.slaPolicy.findFirst({
          where: { tenant_id: t.id, name: { startsWith: 'global_' } },
          select: { business_hours: true },
        });
        if (!slaPolicySample) continue;

        const bh = (slaPolicySample.business_hours as any) ?? {};
        const escalationRules = bh.escalation_rules ?? {};
        const intervalMinutes: number = escalationRules.s1ReAlertIntervalMinutes ?? 30;

        const criticalBreached = await this.prisma.ticket.findMany({
          where: {
            tenant_id: t.id,
            priority: 'CRITICAL' as any,
            status: { notIn: ['RESOLVED', 'CLOSED'] as any },
            sla_deadline_at: { lt: now },
          },
          select: { id: true, ticket_number: true, title: true },
        });

        for (const ticket of criticalBreached) {
          try {
            const lastAlert = await this.prisma.notification.findFirst({
              where: {
                tenant_id: t.id,
                type: 'sla_breach',
                data: { path: ['ticket_id'], equals: ticket.id },
              },
              orderBy: { created_at: 'desc' },
            });

            const minutesSinceLastAlert = lastAlert
              ? (now.getTime() - lastAlert.created_at.getTime()) / 60000
              : intervalMinutes + 1;

            if (minutesSinceLastAlert >= intervalMinutes) {
              await this.notificationsService.notifyAdmins(
                t.id,
                'sla_breach',
                `S1 Re-Alert: ${ticket.ticket_number}`,
                `CRITICAL ticket "${ticket.title}" has breached SLA and requires immediate attention.`,
                { ticket_id: ticket.id },
              );
            }
          } catch (err: any) {
            this.logger.warn(`s1ReAlertCron failed for ticket ${ticket.id}: ${err?.message}`);
          }
        }
      } catch (err: any) {
        this.logger.warn(`s1ReAlertCron failed for tenant ${t.id}: ${err?.message}`);
      }
    }
  }
}
