import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EscalationsService } from '../escalations/escalations.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { v4 as uuidv4 } from 'uuid';

const PRIORITY_DEFAULTS: Record<string, { responseHours: number; resolutionHours: number }> = {
  URGENT: { responseHours: 1, resolutionHours: 4 },
  HIGH: { responseHours: 4, resolutionHours: 24 },
  MEDIUM: { responseHours: 8, resolutionHours: 48 },
  LOW: { responseHours: 24, resolutionHours: 120 },
};

// DB enum uses URGENT; the frontend/API surface uses CRITICAL as an alias
const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;
const DB_TO_API_PRIORITY: Record<string, string> = { URGENT: 'CRITICAL' };
function apiPriorityToDb(priority: string): string {
  const p = priority.toUpperCase();
  return p === 'CRITICAL' ? 'URGENT' : p;
}
function dbPriorityToApi(priority: string): string {
  return DB_TO_API_PRIORITY[priority] ?? priority;
}
function formatSlaPolicy(policy: any) {
  return { ...policy, priority: dbPriorityToApi(policy.priority) };
}

@Injectable()
export class SlaService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private escalationsService: EscalationsService,
    private systemSettingsService: SystemSettingsService,
  ) {}

  // ── Business-hours-aware deadline computation ─────────────────────────────

  /**
   * Compute a deadline by advancing `minutesToAdd` working minutes from `startAt`,
   * respecting business-hours window and optional weekend exclusion.
   *
   * `bh` shape: { start_time: 'HH:MM', end_time: 'HH:MM', pause_on_weekends: boolean, timezone?: string }
   */
  computeDeadline(
    startAt: Date,
    minutesToAdd: number,
    bh: { start_time?: string; end_time?: string; pause_on_weekends?: boolean; timezone?: string },
  ): Date {
    const startTime = bh.start_time ?? '00:00';
    const endTime = bh.end_time ?? '23:59';
    const pauseOnWeekends = bh.pause_on_weekends ?? false;

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const windowStartMinutes = startH * 60 + startM;
    const windowEndMinutes = endH * 60 + endM;

    // If no real business-hours constraint, use simple calendar math
    const fullDay = windowStartMinutes === 0 && windowEndMinutes >= 23 * 60 + 59;
    if (fullDay && !pauseOnWeekends) {
      return new Date(startAt.getTime() + minutesToAdd * 60 * 1000);
    }

    let cursor = new Date(startAt.getTime());
    let remaining = minutesToAdd;

    // Advance cursor to start of business window if before window start
    const clampToWindowStart = (d: Date) => {
      const hhmm = d.getHours() * 60 + d.getMinutes();
      if (hhmm < windowStartMinutes) {
        d.setHours(startH, startM, 0, 0);
      } else if (hhmm >= windowEndMinutes) {
        // Past end of today — move to next business day start
        d.setDate(d.getDate() + 1);
        d.setHours(startH, startM, 0, 0);
      }
    };

    const isWeekend = (d: Date) => {
      const day = d.getDay();
      return day === 0 || day === 6;
    };

    const skipWeekend = (d: Date) => {
      while (pauseOnWeekends && isWeekend(d)) {
        d.setDate(d.getDate() + 1);
        d.setHours(startH, startM, 0, 0);
      }
    };

    skipWeekend(cursor);
    clampToWindowStart(cursor);
    skipWeekend(cursor);

    while (remaining > 0) {
      const curHHMM = cursor.getHours() * 60 + cursor.getMinutes();
      const minutesLeftInWindow = windowEndMinutes - curHHMM;

      if (minutesLeftInWindow <= 0) {
        // Move to next business day start
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(startH, startM, 0, 0);
        skipWeekend(cursor);
        continue;
      }

      if (remaining <= minutesLeftInWindow) {
        cursor = new Date(cursor.getTime() + remaining * 60 * 1000);
        remaining = 0;
      } else {
        remaining -= minutesLeftInWindow;
        cursor.setDate(cursor.getDate() + 1);
        cursor.setHours(startH, startM, 0, 0);
        skipWeekend(cursor);
      }
    }

    return cursor;
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async findAll(tenantId: string) {
    const data = await this.prisma.slaPolicy.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
    });
    return { data };
  }

  async findOne(id: string, tenantId: string) {
    const policy = await this.prisma.slaPolicy.findFirst({ where: { id, tenant_id: tenantId } });
    if (!policy) throw new NotFoundException('SLA policy not found');
    return { data: formatSlaPolicy(policy) };
  }

  async create(tenantId: string, dto: {
    name: string;
    priority: string;
    first_response_minutes: number;
    resolution_minutes: number;
    business_hours?: any;
    timezone?: string;
  }) {
    const policy = await this.prisma.slaPolicy.create({
      data: {
        tenant_id: tenantId,
        name: dto.name,
        priority: apiPriorityToDb(dto.priority) as any,
        first_response_minutes: dto.first_response_minutes,
        resolution_minutes: dto.resolution_minutes,
        business_hours: dto.business_hours ?? {},
        timezone: dto.timezone ?? 'UTC',
      },
    });
    return { data: formatSlaPolicy(policy) };
  }

  async update(id: string, tenantId: string, dto: any) {
    const policy = await this.prisma.slaPolicy.findFirst({ where: { id, tenant_id: tenantId } });
    if (!policy) throw new NotFoundException('SLA policy not found');

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.priority !== undefined) updateData.priority = apiPriorityToDb(dto.priority);
    if (dto.first_response_minutes !== undefined) updateData.first_response_minutes = dto.first_response_minutes;
    if (dto.resolution_minutes !== undefined) updateData.resolution_minutes = dto.resolution_minutes;
    if (dto.business_hours !== undefined) updateData.business_hours = dto.business_hours;
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;

    const updated = await this.prisma.slaPolicy.update({ where: { id }, data: updateData });
    return { data: formatSlaPolicy(updated) };
  }

  async remove(id: string, tenantId: string) {
    const policy = await this.prisma.slaPolicy.findFirst({ where: { id, tenant_id: tenantId } });
    if (!policy) throw new NotFoundException('SLA policy not found');
    await this.prisma.slaPolicy.delete({ where: { id } });
    return { success: true, message: 'SLA policy deleted' };
  }

  // ── Global SLA Policy ─────────────────────────────────────────────────────

  async getGlobalPolicy(tenantId: string) {
    const rows = await this.prisma.slaPolicy.findMany({
      where: { tenant_id: tenantId, name: { startsWith: 'global_' } },
    });

    const byPriority: Record<string, any> = {};
    for (const p of PRIORITIES) {
      const row = rows.find((r) => r.priority === p);
      const apiKey = DB_TO_API_PRIORITY[p] ?? p;
      byPriority[apiKey] = {
        responseHours: row ? row.first_response_minutes / 60 : PRIORITY_DEFAULTS[p].responseHours,
        resolutionHours: row ? row.resolution_minutes / 60 : PRIORITY_DEFAULTS[p].resolutionHours,
      };
    }

    const sample = rows[0];
    const businessHours = (sample?.business_hours as any) || {};
    // escalation_rules stored inside business_hours JSON to avoid schema change
    const escalationRules = businessHours.escalation_rules ?? {
      autoEscalateAtPercent: 80,
      notifyAdminAtPercent: 60,
      s1ReAlertIntervalMinutes: 30,
    };

    return {
      data: {
        id: sample?.id ?? 'global',
        name: 'Global Default Policy',
        description: 'Tenant-wide default SLA policy',
        isDefault: true,
        organizationId: null,
        priorities: byPriority,
        escalationRules,
        businessHours: {
          startTime: businessHours.start_time ?? '09:00',
          endTime: businessHours.end_time ?? '18:00',
          timezone: sample?.timezone ?? 'UTC',
          pauseOnWeekends: businessHours.pause_on_weekends ?? false,
        },
        created_at: sample?.created_at ?? new Date(),
        updated_at: sample?.created_at ?? new Date(),
      },
    };
  }

  async upsertGlobalPolicy(tenantId: string, dto: any) {
    const { priorities, escalationRules, businessHours } = dto;

    for (const dbPriority of PRIORITIES) {
      // Accept both the DB enum value (URGENT) and its API alias (CRITICAL) from the request body
      const apiKey = DB_TO_API_PRIORITY[dbPriority] ?? dbPriority;
      const priorityData = priorities?.[dbPriority] ?? priorities?.[apiKey];
      if (!priorityData) continue;
      const { responseHours, resolutionHours } = priorityData;
      const p = dbPriority;
      const existing = await this.prisma.slaPolicy.findFirst({
        where: { tenant_id: tenantId, name: `global_${p}`, priority: p as any },
      });

      const bh: any = {};
      if (businessHours) {
        bh.start_time = businessHours.startTime;
        bh.end_time = businessHours.endTime;
        bh.pause_on_weekends = businessHours.pauseOnWeekends;
      }
      // Store escalation_rules inside the business_hours JSON blob
      if (escalationRules) {
        bh.escalation_rules = {
          autoEscalateAtPercent: escalationRules.autoEscalateAtPercent,
          notifyAdminAtPercent: escalationRules.notifyAdminAtPercent,
          s1ReAlertIntervalMinutes: escalationRules.s1ReAlertIntervalMinutes,
        };
      }

      if (existing) {
        const existingBh = (existing.business_hours as any) || {};
        // Merge so we don't overwrite fields not present in this call
        const mergedBh = { ...existingBh, ...bh };
        if (escalationRules) mergedBh.escalation_rules = bh.escalation_rules;

        await this.prisma.slaPolicy.update({
          where: { id: existing.id },
          data: {
            first_response_minutes: Math.round(responseHours * 60),
            resolution_minutes: Math.round(resolutionHours * 60),
            business_hours: mergedBh,
            ...(businessHours?.timezone ? { timezone: businessHours.timezone } : {}),
          },
        });
      } else {
        await this.prisma.slaPolicy.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            name: `global_${p}`,
            priority: p as any,
            first_response_minutes: Math.round(responseHours * 60),
            resolution_minutes: Math.round(resolutionHours * 60),
            business_hours: bh,
            timezone: businessHours?.timezone ?? 'UTC',
          },
        });
      }
    }

    return this.getGlobalPolicy(tenantId);
  }

  async assignToTicket(ticketId: string, tenantId: string, policyId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, tenant_id: tenantId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const policy = await this.prisma.slaPolicy.findFirst({ where: { id: policyId, tenant_id: tenantId } });
    if (!policy) throw new NotFoundException('SLA policy not found');

    const bh = (policy.business_hours as any) || {};
    const deadline = this.computeDeadline(ticket.created_at, policy.resolution_minutes, bh);
    const firstResponseDeadline = this.computeDeadline(ticket.created_at, policy.first_response_minutes, bh);

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { sla_policy_id: policyId, sla_deadline_at: deadline },
    });

    return {
      data: {
        ticket_id: ticketId,
        sla_policy_id: policyId,
        sla_deadline_at: deadline,
        first_response_deadline: firstResponseDeadline,
      },
    };
  }

  // ── SLA Threshold Enforcement ─────────────────────────────────────────────

  /**
   * Check all open tickets against escalation thresholds.
   * - If SLA % elapsed >= notifyAdminAtPercent → create sla_warning notification for admins/leads
   * - If SLA % elapsed >= autoEscalateAtPercent → auto-create escalation + update ticket to ESCALATED
   * - If emailOnSLABreach + slackIntegrationEnabled → also post to Slack
   *
   * Safe to call repeatedly — checks for existing notifications/escalations to avoid duplicates.
   */
  async checkSlaThresholds(tenantId: string) {
    const globalPolicy = await this.getGlobalPolicy(tenantId);
    const escalationRules = globalPolicy.data.escalationRules;
    const { autoEscalateAtPercent, notifyAdminAtPercent, s1ReAlertIntervalMinutes } = escalationRules;

    const systemSettings = await this.systemSettingsService.getSettings(tenantId);
    const { emailOnSLABreach, slackIntegrationEnabled, slackChannel } = systemSettings.data.notifications;

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Find open tickets with an SLA deadline set
    const tickets = await this.prisma.ticket.findMany({
      where: {
        tenant_id: tenantId,
        status: { notIn: ['RESOLVED', 'CLOSED'] },
        sla_deadline_at: { not: null },
      },
      select: {
        id: true,
        ticket_number: true,
        title: true,
        priority: true,
        status: true,
        created_at: true,
        sla_deadline_at: true,
        requester_id: true,
      },
    });

    const warned: string[] = [];
    const escalated: string[] = [];

    for (const ticket of tickets) {
      const deadline = ticket.sla_deadline_at!;
      const totalWindow = deadline.getTime() - ticket.created_at.getTime();
      if (totalWindow <= 0) continue;
      const elapsed = now.getTime() - ticket.created_at.getTime();
      const percentElapsed = Math.round((elapsed / totalWindow) * 100);

      // ── Notify admin threshold ────────────────────────────────────────────
      if (percentElapsed >= notifyAdminAtPercent) {
        // Check if we already sent a warning in the last hour
        const recentWarning = await this.prisma.notification.findFirst({
          where: {
            tenant_id: tenantId,
            type: 'sla_warning',
            data: { path: ['ticket_id'], equals: ticket.id },
            created_at: { gte: oneHourAgo },
          },
        });

        if (!recentWarning) {
          const message = `Ticket ${ticket.ticket_number} — "${ticket.title}" is at ${percentElapsed}% of SLA time (${ticket.priority})`;
          await this.notificationsService.notifyAdmins(
            tenantId,
            'sla_warning',
            'SLA Warning',
            message,
            { ticket_id: ticket.id, percent_elapsed: percentElapsed },
          );

          if (slackIntegrationEnabled && slackChannel) {
            await this.notificationsService.postToSlack(slackChannel, `⚠️ SLA Warning: ${message}`);
          }
          warned.push(ticket.id);
        }
      }

      // ── Auto-escalate threshold ───────────────────────────────────────────
      if (percentElapsed >= autoEscalateAtPercent && (ticket.status as string) !== 'ESCALATED') {
        // Check if there's already an open escalation
        const existingEscalation = await this.prisma.escalation.findFirst({
          where: { tenant_id: tenantId, ticket_id: ticket.id, status: 'open' },
        });

        if (!existingEscalation) {
          await this.escalationsService.create(tenantId, {
            ticket_id: ticket.id,
            reason: `Auto-escalated: SLA ${percentElapsed}% elapsed (threshold: ${autoEscalateAtPercent}%)`,
          });

          await this.prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: 'ESCALATED' },
          });

          if (emailOnSLABreach) {
            await this.notificationsService.notifyAdmins(
              tenantId,
              'sla_breach',
              'SLA Breach — Auto-escalated',
              `Ticket ${ticket.ticket_number} has been auto-escalated (${percentElapsed}% elapsed)`,
              { ticket_id: ticket.id, percent_elapsed: percentElapsed },
            );
          }

          if (slackIntegrationEnabled && slackChannel) {
            await this.notificationsService.postToSlack(
              slackChannel,
              `🚨 SLA Breach: Ticket ${ticket.ticket_number} auto-escalated at ${percentElapsed}% elapsed`,
            );
          }
          escalated.push(ticket.id);
        }
      }

      // ── S1 re-alert (CRITICAL past deadline) ─────────────────────────────
      if ((ticket.priority as string) === 'CRITICAL' && now > deadline) {
        const reAlertWindow = new Date(now.getTime() - s1ReAlertIntervalMinutes * 60 * 1000);
        const recentAlert = await this.prisma.notification.findFirst({
          where: {
            tenant_id: tenantId,
            type: 'sla_breach',
            data: { path: ['ticket_id'], equals: ticket.id },
            created_at: { gte: reAlertWindow },
          },
        });

        if (!recentAlert) {
          const overdueMinutes = Math.round((now.getTime() - deadline.getTime()) / 60000);
          const message = `S1 Alert: Ticket ${ticket.ticket_number} is ${overdueMinutes} min past SLA deadline`;
          await this.notificationsService.notifyAdmins(
            tenantId,
            'sla_breach',
            'S1 SLA Overdue',
            message,
            { ticket_id: ticket.id, overdue_minutes: overdueMinutes },
          );
          if (slackIntegrationEnabled && slackChannel) {
            await this.notificationsService.postToSlack(slackChannel, `🔴 ${message}`);
          }
        }
      }
    }

    return { data: { checked: tickets.length, warned: warned.length, escalated: escalated.length } };
  }
}
