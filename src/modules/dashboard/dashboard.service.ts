import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getKpis(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

    const [
      totalTickets,
      openTickets,
      resolvedToday,
      resolvedWithSla,
      totalWithSla,
      byStatusGroups,
      byPriorityGroups,
      recentActivity,
      avgResolutionRaw,
    ] = await Promise.all([
      this.prisma.ticket.count({ where: { tenant_id: tenantId } }),
      this.prisma.ticket.count({ where: { tenant_id: tenantId, status: 'OPEN' } }),
      this.prisma.ticket.count({
        where: {
          tenant_id: tenantId,
          status: { in: ['RESOLVED', 'CLOSED'] },
          resolved_at: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM tickets
        WHERE tenant_id = ${tenantId}::uuid
          AND sla_deadline_at IS NOT NULL
          AND resolved_at IS NOT NULL
          AND resolved_at <= sla_deadline_at
      `.then((r) => Number(r[0]?.count ?? 0)).catch(() => 0),
      this.prisma.ticket.count({
        where: { tenant_id: tenantId, sla_deadline_at: { not: null } },
      }),
      this.prisma.ticket.groupBy({ by: ['status'], where: { tenant_id: tenantId }, _count: { id: true } }),
      this.prisma.ticket.groupBy({ by: ['priority'], where: { tenant_id: tenantId }, _count: { id: true } }),
      this.prisma.ticket.findMany({
        where: { tenant_id: tenantId },
        orderBy: { updated_at: 'desc' },
        take: 10,
        select: {
          id: true,
          ticket_number: true,
          title: true,
          status: true,
          priority: true,
          updated_at: true,
          assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
        },
      }),
      this.prisma.$queryRaw<[{ avg: number | null }]>`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 1) as avg
        FROM tickets
        WHERE tenant_id = ${tenantId}::uuid
          AND resolved_at IS NOT NULL
          AND created_at >= ${thirtyDaysAgo}
      `.then((r) => Number(r[0]?.avg ?? 0)).catch(() => 0),
    ]);

    const by_status = Object.fromEntries(
      byStatusGroups.map((g) => [g.status, g._count.id]),
    );
    const by_priority = Object.fromEntries(
      byPriorityGroups.map((g) => [g.priority === 'URGENT' ? 'CRITICAL' : g.priority, g._count.id]),
    );

    const slaComplianceRate = totalWithSla > 0
      ? Math.round((resolvedWithSla / totalWithSla) * 10000) / 10000
      : 0;

    const avgResolutionTime = avgResolutionRaw > 0 ? `${avgResolutionRaw.toFixed(1)}h` : '—';

    // Shape matches frontend DashboardSummary + ActivityItem types exactly
    return {
      data: {
        total: totalTickets,
        resolvedToday: resolvedToday,
        avgResolutionTime,
        slaComplianceRate,
        by_status,
        by_priority,
        recentActivity: recentActivity.map((t) => ({
          id: t.id,
          type: 'status_change',
          description: `${t.ticket_number} ${t.title}`,
          userId: t.assignee?.id ?? '',
          userName: t.assignee
            ? [t.assignee.first_name, t.assignee.last_name].filter(Boolean).join(' ') || t.assignee.email
            : 'Unassigned',
          resourceType: 'ticket',
          resourceId: t.id,
          timestamp: t.updated_at.toISOString(),
        })),
      },
    };
  }

  async getAgentStats(tenantId: string) {
    const agents = await this.prisma.user.findMany({
      where: { tenant_id: tenantId, role: { in: ['AGENT', 'LEAD'] as any } },
      include: { workloads: true },
    });

    const stats = await Promise.all(
      agents.map(async (agent) => {
        const assigned = await this.prisma.ticket.count({
          where: { assignee_id: agent.id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
        });
        const wl = agent.workloads?.[0];
        const cap = wl?.max_capacity ?? 10;
        return {
          user_id: agent.id,
          display_name:
            [agent.first_name, agent.last_name].filter(Boolean).join(' ') || agent.email,
          email: agent.email,
          role: agent.role,
          active_tickets: assigned,
          max_capacity: cap,
          utilization_pct: Math.round((assigned / cap) * 100 * 100) / 100,
          availability_status: (wl?.availability ?? 'AVAILABLE').toUpperCase(),
        };
      }),
    );

    return { data: stats };
  }
}
