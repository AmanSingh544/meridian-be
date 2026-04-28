import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async ticketVolume(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await this.prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT DATE(created_at)::text as date, COUNT(*)::bigint as count
      FROM tickets
      WHERE tenant_id = ${tenantId}::uuid AND created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return { data: rows.map((r) => ({ date: r.date, count: Number(r.count) })) };
  }

  async slaCompliance(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [total, onTime] = await Promise.all([
      this.prisma.ticket.count({ where: { tenant_id: tenantId, sla_deadline_at: { not: null }, created_at: { gte: since } } }),
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM tickets
        WHERE tenant_id = ${tenantId}::uuid
          AND sla_deadline_at IS NOT NULL
          AND resolved_at IS NOT NULL
          AND resolved_at <= sla_deadline_at
          AND created_at >= ${since}
      `.then((r) => Number(r[0]?.count ?? 0)),
    ]);

    const breached = total - onTime;
    const complianceRate = total > 0 ? Math.round((onTime / total) * 10000) / 10000 : 0;

    return {
      data: [
        {
          period: new Date().toISOString().slice(0, 7),
          responseCompliance: complianceRate,
          resolutionCompliance: complianceRate,
          totalTickets: total,
          breachedTickets: breached,
        },
      ],
    };
  }

  async resolutionTrends(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.prisma.$queryRaw<Array<{ week: string; avg_hours: string }>>`
      SELECT DATE_TRUNC('week', resolved_at)::text as week,
             ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as avg_hours
      FROM tickets
      WHERE tenant_id = ${tenantId}::uuid
        AND resolved_at IS NOT NULL
        AND created_at >= ${since}
      GROUP BY DATE_TRUNC('week', resolved_at)
      ORDER BY week ASC
    `;

    return {
      data: rows.map((r) => ({
        period: r.week,
        avgResolutionHours: Number(r.avg_hours),
        medianResolutionHours: Number(r.avg_hours),
        p95ResolutionHours: Number(r.avg_hours),
      })),
    };
  }

  async agentPerformance(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const agents = await this.prisma.user.findMany({
      where: { tenant_id: tenantId, role: { in: ['AGENT', 'LEAD'] as any } },
      select: { id: true, first_name: true, last_name: true, email: true, role: true },
    });

    const stats = await Promise.all(
      agents.map(async (agent) => {
        const [assigned, resolved] = await Promise.all([
          this.prisma.ticket.count({
            where: { assignee_id: agent.id, created_at: { gte: since } },
          }),
          this.prisma.ticket.count({
            where: { assignee_id: agent.id, status: { in: ['RESOLVED', 'CLOSED'] }, updated_at: { gte: since } },
          }),
        ]);

        const avgHoursRow = await this.prisma.$queryRaw<[{ avg_hours: string | null }]>`
          SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as avg_hours
          FROM tickets
          WHERE assignee_id = ${agent.id}::uuid
            AND resolved_at IS NOT NULL
            AND updated_at >= ${since}
        `;

        const [slaTotal, slaOnTime] = await Promise.all([
          this.prisma.ticket.count({
            where: { assignee_id: agent.id, sla_deadline_at: { not: null }, created_at: { gte: since } },
          }),
          this.prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*)::bigint as count FROM tickets
            WHERE assignee_id = ${agent.id}::uuid
              AND sla_deadline_at IS NOT NULL
              AND resolved_at IS NOT NULL
              AND resolved_at <= sla_deadline_at
              AND created_at >= ${since}
          `.then((r) => Number(r[0]?.count ?? 0)),
        ]);

        return {
          agentId: agent.id,
          agentName: [agent.first_name, agent.last_name].filter(Boolean).join(' ') || agent.email,
          ticketsAssigned: assigned,
          ticketsResolved: resolved,
          avgResolutionHours: Number(avgHoursRow[0]?.avg_hours ?? 0),
          slaCompliance: slaTotal > 0 ? slaOnTime / slaTotal : 0,
        };
      }),
    );

    return { data: stats };
  }

  async monthlyVolume(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.prisma.$queryRaw<Array<{ month: string; created: bigint; resolved: bigint }>>`
      SELECT
        TO_CHAR(created_at, 'Mon YYYY') as month,
        COUNT(*)::bigint as created,
        COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)::bigint as resolved
      FROM tickets
      WHERE tenant_id = ${tenantId}::uuid
        AND created_at >= ${since}
      GROUP BY TO_CHAR(created_at, 'Mon YYYY'), DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `;
    return { data: rows.map((r) => ({ month: r.month, created: Number(r.created), resolved: Number(r.resolved) })) };
  }

  async categoryBreakdown(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const groups = await this.prisma.ticket.groupBy({
      by: ['category'],
      where: { tenant_id: tenantId, created_at: { gte: since } },
      _count: { id: true },
    });
    return { data: groups.map((g) => ({ category: g.category ?? 'UNCATEGORIZED', count: g._count.id })) };
  }

  async severityDistribution(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const groups = await this.prisma.ticket.groupBy({
      by: ['priority'],
      where: { tenant_id: tenantId, created_at: { gte: since } },
      _count: { id: true },
    });
    return { data: groups.map((g) => ({ priority: g.priority, count: g._count.id })) };
  }

  async resolutionBySeverity(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    let rows = await this.prisma.$queryRaw<Array<{ priority: string; avg_hours: string }>>`
      SELECT priority::text, ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as avg_hours
      FROM tickets
      WHERE tenant_id = ${tenantId}::uuid
        AND resolved_at IS NOT NULL
        AND created_at >= ${since}
      GROUP BY priority
    `;

    // Fall back to all-time averages when the window has no resolved tickets
    if (!rows.length) {
      rows = await this.prisma.$queryRaw<Array<{ priority: string; avg_hours: string }>>`
        SELECT priority::text, ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::numeric, 2) as avg_hours
        FROM tickets
        WHERE tenant_id = ${tenantId}::uuid
          AND resolved_at IS NOT NULL
        GROUP BY priority
      `;
    }

    return { data: rows.map((r) => ({ priority: r.priority, avgHours: Number(r.avg_hours ?? 0) })) };
  }
}
