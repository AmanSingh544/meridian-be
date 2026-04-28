import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

const PRIORITY_DEFAULTS: Record<string, { responseHours: number; resolutionHours: number }> = {
  CRITICAL: { responseHours: 1, resolutionHours: 4 },
  HIGH: { responseHours: 4, resolutionHours: 24 },
  MEDIUM: { responseHours: 8, resolutionHours: 48 },
  LOW: { responseHours: 24, resolutionHours: 120 },
};

const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

@Injectable()
export class SlaService {
  constructor(private prisma: PrismaService) {}

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
    return { data: policy };
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
        priority: dto.priority as any,
        first_response_minutes: dto.first_response_minutes,
        resolution_minutes: dto.resolution_minutes,
        business_hours: dto.business_hours ?? {},
        timezone: dto.timezone ?? 'UTC',
      },
    });
    return { data: policy };
  }

  async update(id: string, tenantId: string, dto: any) {
    const policy = await this.prisma.slaPolicy.findFirst({ where: { id, tenant_id: tenantId } });
    if (!policy) throw new NotFoundException('SLA policy not found');

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.first_response_minutes !== undefined) updateData.first_response_minutes = dto.first_response_minutes;
    if (dto.resolution_minutes !== undefined) updateData.resolution_minutes = dto.resolution_minutes;
    if (dto.business_hours !== undefined) updateData.business_hours = dto.business_hours;
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;

    const updated = await this.prisma.slaPolicy.update({ where: { id }, data: updateData });
    return { data: updated };
  }

  async remove(id: string, tenantId: string) {
    const policy = await this.prisma.slaPolicy.findFirst({ where: { id, tenant_id: tenantId } });
    if (!policy) throw new NotFoundException('SLA policy not found');
    await this.prisma.slaPolicy.delete({ where: { id } });
    return { success: true, message: 'SLA policy deleted' };
  }

  // ── Global SLA Policy (unified 4-priority view used by SLAConfigPage) ──────

  async getGlobalPolicy(tenantId: string) {
    const rows = await this.prisma.slaPolicy.findMany({
      where: { tenant_id: tenantId, name: { startsWith: 'global_' } },
    });

    const byPriority: Record<string, any> = {};
    for (const p of PRIORITIES) {
      const row = rows.find((r) => r.priority === p);
      byPriority[p] = {
        responseHours: row ? row.first_response_minutes / 60 : PRIORITY_DEFAULTS[p].responseHours,
        resolutionHours: row ? row.resolution_minutes / 60 : PRIORITY_DEFAULTS[p].resolutionHours,
      };
    }

    const sample = rows[0];
    const businessHours = (sample?.business_hours as any) || {};

    return {
      data: {
        id: sample?.id ?? 'global',
        name: 'Global Default Policy',
        description: 'Tenant-wide default SLA policy',
        isDefault: true,
        organizationId: null,
        priorities: byPriority,
        escalationRules: {
          warningThresholdPercent: 80,
          autoEscalateEnabled: true,
          autoEscalateAfterPercent: 95,
          notifyAgentOnWarning: true,
          notifyLeadOnEscalation: true,
        },
        businessHours: {
          startTime: businessHours.start_time ?? '09:00',
          endTime: businessHours.end_time ?? '18:00',
          timezone: sample?.timezone ?? 'UTC',
          pauseOnWeekends: businessHours.pause_on_weekends ?? true,
        },
        created_at: sample?.created_at ?? new Date(),
        updated_at: sample?.created_at ?? new Date(),
      },
    };
  }

  async upsertGlobalPolicy(tenantId: string, dto: any) {
    const { priorities, escalationRules, businessHours } = dto;

    for (const p of PRIORITIES) {
      if (!priorities?.[p]) continue;
      const { responseHours, resolutionHours } = priorities[p];
      const existing = await this.prisma.slaPolicy.findFirst({
        where: { tenant_id: tenantId, name: `global_${p}`, priority: p as any },
      });
      const bh = businessHours
        ? {
            start_time: businessHours.startTime,
            end_time: businessHours.endTime,
            pause_on_weekends: businessHours.pauseOnWeekends,
          }
        : undefined;

      if (existing) {
        await this.prisma.slaPolicy.update({
          where: { id: existing.id },
          data: {
            first_response_minutes: Math.round(responseHours * 60),
            resolution_minutes: Math.round(resolutionHours * 60),
            ...(bh ? { business_hours: bh } : {}),
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
            business_hours: bh ?? {},
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

    const deadline = new Date(ticket.created_at.getTime() + policy.resolution_minutes * 60 * 1000);

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { sla_policy_id: policyId, sla_deadline_at: deadline },
    });

    return {
      data: {
        ticket_id: ticketId,
        sla_policy_id: policyId,
        sla_deadline_at: deadline,
        first_response_deadline: new Date(ticket.created_at.getTime() + policy.first_response_minutes * 60 * 1000),
      },
    };
  }
}
