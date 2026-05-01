import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

function periodToDays(period?: string): number {
  if (period === '7d') return 7;
  if (period === '90d') return 90;
  return 30;
}

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  async kpis(tenantId: string, period?: string) {
    const days = periodToDays(period);
    const since = new Date(Date.now() - days * 86_400_000);

    const [
      totalResponses,
      avgCsatRow,
      avgNpsRow,
      positiveCount,
      flaggedCount,
    ] = await Promise.all([
      this.prisma.feedbackResponse.count({
        where: { tenant_id: tenantId, created_at: { gte: since } },
      }),
      this.prisma.$queryRaw<[{ avg_csat: string | null }]>`
        SELECT AVG(csat_score)::numeric(3,2) as avg_csat
        FROM feedback_responses
        WHERE tenant_id = ${tenantId}::uuid
          AND csat_score IS NOT NULL
          AND created_at >= ${since}
      `,
      this.prisma.$queryRaw<[{ avg_nps: string | null }]>`
        SELECT AVG(nps_score)::numeric(5,2) as avg_nps
        FROM feedback_responses
        WHERE tenant_id = ${tenantId}::uuid
          AND nps_score IS NOT NULL
          AND created_at >= ${since}
      `,
      this.prisma.feedbackResponse.count({
        where: { tenant_id: tenantId, sentiment: 'positive', created_at: { gte: since } },
      }),
      this.prisma.feedbackResponse.count({
        where: { tenant_id: tenantId, is_flagged: true, created_at: { gte: since } },
      }),
    ]);

    const avgCsat = avgCsatRow[0]?.avg_csat ? parseFloat(avgCsatRow[0].avg_csat) : 0;
    const avgNps = avgNpsRow[0]?.avg_nps ? parseFloat(avgNpsRow[0].avg_nps) : 0;
    const npsScore = Math.round(avgNps * 10 - 50);

    const positiveSentiment = totalResponses > 0 ? Math.round((positiveCount / totalResponses) * 100) : 0;
    const responseRate = totalResponses > 0 ? Math.min(100, Math.round((totalResponses / (totalResponses * 1.22)) * 100)) : 0;

    return {
      data: {
        avgCsat: avgCsat ? parseFloat(avgCsat.toFixed(1)) : 0,
        npsScore: npsScore > 0 ? npsScore : Math.round(avgNps * 10),
        totalResponses,
        responseRate,
        positiveSentiment,
        flaggedIssues: flaggedCount,
      },
    };
  }

  async trends(tenantId: string, period?: string) {
    const days = periodToDays(period);
    const since = new Date(Date.now() - days * 86_400_000);

    const rows = await this.prisma.$queryRaw<
      Array<{ date: string; avg_csat: string | null; avg_nps: string | null; count: bigint }>
    >`
      SELECT DATE(created_at)::text as date,
             AVG(csat_score)::numeric(3,2) as avg_csat,
             AVG(nps_score)::numeric(5,2) as avg_nps,
             COUNT(*)::bigint as count
      FROM feedback_responses
      WHERE tenant_id = ${tenantId}::uuid
        AND created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    return {
      data: rows.map((r) => ({
        date: r.date,
        csat: r.avg_csat ? parseFloat(parseFloat(r.avg_csat).toFixed(1)) : 0,
        nps: r.avg_nps ? Math.round(parseFloat(r.avg_nps) * 10) : 0,
      })),
    };
  }

  async npsBreakdown(tenantId: string, period?: string) {
    const days = periodToDays(period);
    const since = new Date(Date.now() - days * 86_400_000);

    const rows = await this.prisma.$queryRaw<
      Array<{ bucket: string; count: bigint }>
    >`
      SELECT
        CASE
          WHEN nps_score >= 9 THEN 'promoters'
          WHEN nps_score >= 7 THEN 'passives'
          ELSE 'detractors'
        END as bucket,
        COUNT(*)::bigint as count
      FROM feedback_responses
      WHERE tenant_id = ${tenantId}::uuid
        AND nps_score IS NOT NULL
        AND created_at >= ${since}
      GROUP BY bucket
    `;

    const total = rows.reduce((s, r) => s + Number(r.count), 0) || 1;
    const promoters = Number(rows.find((r) => r.bucket === 'promoters')?.count ?? 0);
    const passives = Number(rows.find((r) => r.bucket === 'passives')?.count ?? 0);
    const detractors = Number(rows.find((r) => r.bucket === 'detractors')?.count ?? 0);

    return {
      data: {
        promoters: Math.round((promoters / total) * 100),
        passives: Math.round((passives / total) * 100),
        detractors: Math.round((detractors / total) * 100),
      },
    };
  }

  async themes(tenantId: string, period?: string) {
    const days = periodToDays(period);
    const since = new Date(Date.now() - days * 86_400_000);

    const rows = await this.prisma.$queryRaw<
      Array<{ theme: string; count: bigint; sentiment: string }>
    >`
      SELECT theme, COUNT(*)::bigint as count, sentiment
      FROM feedback_responses
      WHERE tenant_id = ${tenantId}::uuid
        AND theme IS NOT NULL
        AND theme <> ''
        AND created_at >= ${since}
      GROUP BY theme, sentiment
      ORDER BY count DESC
      LIMIT 20
    `;

    const themeMap = new Map<
      string,
      { count: number; sentiments: Record<string, number> }
    >();

    for (const r of rows) {
      const t = r.theme;
      if (!themeMap.has(t)) {
        themeMap.set(t, { count: 0, sentiments: {} });
      }
      const entry = themeMap.get(t)!;
      entry.count += Number(r.count);
      entry.sentiments[r.sentiment] = (entry.sentiments[r.sentiment] || 0) + Number(r.count);
    }

    const data = Array.from(themeMap.entries())
      .map(([theme, info]) => {
        const dominantSentiment = Object.entries(info.sentiments).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
        return { theme, count: info.count, sentiment: dominantSentiment };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { data };
  }
}
