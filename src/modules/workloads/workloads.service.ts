import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class WorkloadsService {
  constructor(private prisma: PrismaService) {}

  async getUserWorkload(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const assignedTickets = await this.prisma.ticket.count({
      where: { assignee_id: userId, status: { notIn: ['RESOLVED', 'CLOSED'] } },
    });

    let workload = await this.prisma.workload.findFirst({ where: { user_id: userId } });
    if (!workload) {
      workload = await this.prisma.workload.create({
        data: { user_id: userId, active_tickets: 0, max_capacity: 10, availability: 'AVAILABLE' },
      });
    }

    return {
      data: {
        user_id: userId,
        assigned_tickets: assignedTickets,
        max_capacity: workload.max_capacity,
        utilization_pct: Math.round((assignedTickets / workload.max_capacity) * 100 * 100) / 100,
        availability_status: workload.availability.toUpperCase(),
      },
    };
  }

  async updateUserWorkload(
    userId: string,
    tenantId: string,
    dto: { max_capacity?: number; availability_status?: string },
    actorId: string,
    actorRole: string,
  ) {
    if (dto.max_capacity !== undefined && actorId !== userId && !['ADMIN', 'LEAD'].includes(actorRole)) {
      throw new ForbiddenException('Only ADMIN/LEAD can update max_capacity');
    }
    if ((dto as any).assigned_tickets !== undefined || (dto as any).utilization_pct !== undefined) {
      throw new BadRequestException('READONLY_FIELD');
    }

    const user = await this.prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId } });
    if (!user) throw new NotFoundException('User not found');

    let workload = await this.prisma.workload.findFirst({ where: { user_id: userId } });
    const updateData: any = {};
    if (dto.max_capacity !== undefined) updateData.max_capacity = dto.max_capacity;
    if (dto.availability_status !== undefined) updateData.availability = dto.availability_status;

    if (workload) {
      await this.prisma.workload.update({ where: { id: workload.id }, data: updateData });
    } else {
      await this.prisma.workload.create({ data: { user_id: userId, ...updateData } });
    }

    return this.getUserWorkload(userId, tenantId);
  }

  async getWorkloadSummary(tenantId: string) {
    const agents = await this.prisma.user.findMany({
      where: { tenant_id: tenantId, role: { in: ['AGENT', 'LEAD', 'ADMIN'] as any } },
      include: { workloads: true },
    });

    const statusCounts: Record<string, number> = { AVAILABLE: 0, BUSY: 0, AWAY: 0, OFFLINE: 0, DO_NOT_DISTURB: 0 };
    let totalUtil = 0;
    let overloaded = 0;

    for (const agent of agents) {
      const wl = agent.workloads?.[0];
      const status = (wl?.availability ?? 'AVAILABLE').toUpperCase();
      if (status in statusCounts) statusCounts[status]++;

      const assigned = await this.prisma.ticket.count({
        where: { assignee_id: agent.id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      });
      const cap = wl?.max_capacity ?? 10;
      const pct = (assigned / cap) * 100;
      totalUtil += pct;
      if (pct >= 90) overloaded++;
    }

    return {
      data: {
        total_agents: agents.length,
        available_agents: statusCounts.AVAILABLE,
        busy_agents: statusCounts.BUSY,
        away_agents: statusCounts.AWAY,
        offline_agents: statusCounts.OFFLINE + statusCounts.DO_NOT_DISTURB,
        avg_utilization: agents.length ? Math.round((totalUtil / agents.length) * 100) / 10000 : 0,
        overloaded_agents: overloaded,
      },
    };
  }
}
