import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

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
