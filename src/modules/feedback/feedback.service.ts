import {
  Injectable, BadRequestException, NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSurveyTokenDto, SubmitSurveyDto } from './dto/feedback.dto';

function periodToDays(period?: string): number {
  if (period === '7d') return 7;
  if (period === '90d') return 90;
  return 30;
}

function deriveSentiment(dto: SubmitSurveyDto): string {
  const scores = [
    dto.csat_score, dto.overall_value, dto.ease_of_use, dto.feature_coverage,
    dto.support_quality, dto.account_mgmt,
  ].filter((s): s is number => s != null);

  if (scores.length === 0) return 'neutral';
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg >= 4) return 'positive';
  if (avg <= 2) return 'negative';
  return 'neutral';
}

function deriveTheme(dto: SubmitSurveyDto): string {
  const texts = [dto.open_feedback, dto.overall_comment, dto.product_comment, dto.support_comment]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (texts.includes('slow') || texts.includes('performance') || dto.performance != null && dto.performance <= 2) return 'Performance';
  if (texts.includes('support') || texts.includes('response')) return 'Support';
  if (texts.includes('feature') || texts.includes('missing')) return 'Feature Request';
  if (texts.includes('ui') || texts.includes('interface') || texts.includes('ease')) return 'Usability';
  if (texts.includes('integrat')) return 'Integration';
  if (texts.includes('report') || texts.includes('dashb')) return 'Reporting';
  if ((dto.nps_score ?? 10) >= 9) return 'Highly Satisfied';
  return 'General Feedback';
}

@Injectable()
export class FeedbackService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ─── Survey tokens ──────────────────────────────────────────────────────────

  async createToken(tenantId: string, createdBy: string, dto: CreateSurveyTokenDto) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const token = await this.prisma.surveyToken.create({
      data: {
        tenant_id: tenantId,
        created_by: createdBy,
        customer_email: dto.customer_email,
        customer_name: dto.customer_name,
        company_name: dto.company_name,
        expires_at: expiresAt,
      },
    });

    // In-app notification to admins/leads (email not working in demo)
    await this.notifications.notifyAdmins(
      tenantId,
      'survey_token_created',
      'CSAT Survey Invite Created',
      `Survey link created for ${dto.customer_email}${dto.customer_name ? ` (${dto.customer_name})` : ''}. Share the survey link with the customer.`,
      { token_id: token.id, customer_email: dto.customer_email },
    ).catch(() => undefined); // fire-and-forget

    return { data: token };
  }

  async listTokens(tenantId: string, page = 1, pageSize = 20) {
    const [data, total] = await Promise.all([
      this.prisma.surveyToken.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.surveyToken.count({ where: { tenant_id: tenantId } }),
    ]);

    return {
      data,
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    };
  }

  async validateToken(tokenId: string) {
    const token = await this.prisma.surveyToken.findUnique({ where: { id: tokenId } });
    if (!token) throw new NotFoundException('Survey token not found');
    if (token.used_at) throw new BadRequestException('Survey already completed');
    if (token.expires_at < new Date()) throw new BadRequestException('Survey link has expired');

    return {
      data: {
        valid: true,
        customer_email: token.customer_email,
        customer_name: token.customer_name,
        company_name: token.company_name,
        tenant_id: token.tenant_id,
      },
    };
  }

  // ─── Survey submission ──────────────────────────────────────────────────────

  async submitSurvey(dto: SubmitSurveyDto) {
    const token = await this.prisma.surveyToken.findUnique({ where: { id: dto.token } });
    if (!token) throw new NotFoundException('Survey token not found');
    if (token.used_at) throw new BadRequestException('Survey already completed');
    if (token.expires_at < new Date()) throw new BadRequestException('Survey link has expired');

    const sentiment = deriveSentiment(dto);
    const theme = deriveTheme(dto);
    const is_flagged = (dto.nps_score ?? 10) <= 3 || (dto.csat_score ?? 5) <= 2;

    const response = await this.prisma.feedbackResponse.create({
      data: {
        tenant_id: token.tenant_id,
        survey_token_id: token.id,
        customer_email: token.customer_email,
        customer_name: token.customer_name ?? null,
        selected_modules: dto.selected_modules,
        // Step 2
        csat_score: dto.csat_score ?? null,
        overall_value: dto.overall_value ?? null,
        expectation_met: dto.expectation_met ?? null,
        overall_comment: dto.overall_comment ?? null,
        // Step 3
        ease_of_use: dto.ease_of_use ?? null,
        feature_coverage: dto.feature_coverage ?? null,
        ai_ml_quality: dto.ai_ml_quality ?? null,
        customization: dto.customization ?? null,
        performance: dto.performance ?? null,
        ibp_accuracy: dto.ibp_accuracy ?? null,
        itms_quality: dto.itms_quality ?? null,
        wms_quality: dto.wms_quality ?? null,
        carbonx_quality: dto.carbonx_quality ?? null,
        top_feature: dto.top_feature ?? null,
        product_comment: dto.product_comment ?? null,
        // Step 4
        impl_smoothness: dto.impl_smoothness ?? null,
        training_quality: dto.training_quality ?? null,
        impl_timeline: dto.impl_timeline ?? null,
        time_to_value: dto.time_to_value ?? null,
        integration_quality: dto.integration_quality ?? null,
        impl_comment: dto.impl_comment ?? null,
        // Step 5
        support_responsiveness: dto.support_responsiveness ?? null,
        support_quality: dto.support_quality ?? null,
        account_mgmt: dto.account_mgmt ?? null,
        proactive_comm: dto.proactive_comm ?? null,
        preferred_channel: dto.preferred_channel ?? null,
        support_comment: dto.support_comment ?? null,
        // Step 6
        visibility_improvement: dto.visibility_improvement ?? null,
        kpi_improvement: dto.kpi_improvement ?? null,
        roi_satisfaction: dto.roi_satisfaction ?? null,
        renew_intent: dto.renew_intent ?? null,
        nps_score: dto.nps_score ?? null,
        recommend_reason: dto.recommend_reason ?? null,
        open_feedback: dto.open_feedback ?? null,
        // Derived
        sentiment,
        theme,
        is_flagged,
      },
    });

    // Mark token as used
    await this.prisma.surveyToken.update({
      where: { id: token.id },
      data: { used_at: new Date(), response_id: response.id },
    });

    // Notify internal team
    const title = is_flagged
      ? `⚠ Flagged CSAT Response — NPS ${dto.nps_score ?? 'N/A'}`
      : `New CSAT Response — ${sentiment === 'positive' ? 'Positive' : 'Neutral/Negative'}`;

    await this.notifications.notifyAdmins(
      token.tenant_id,
      is_flagged ? 'csat_flagged' : 'csat_submitted',
      title,
      `Response from ${token.customer_email}. CSAT: ${dto.csat_score ?? 'N/A'}/5, NPS: ${dto.nps_score ?? 'N/A'}/10.`,
      { response_id: response.id, sentiment, is_flagged },
    ).catch(() => undefined);

    return { data: { success: true, response_id: response.id } };
  }

  // ─── Response list ──────────────────────────────────────────────────────────

  async listResponses(tenantId: string, page = 1, pageSize = 20) {
    const [data, total] = await Promise.all([
      this.prisma.feedbackResponse.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, created_at: true, customer_email: true, customer_name: true,
          csat_score: true, nps_score: true, sentiment: true, theme: true,
          is_flagged: true, overall_comment: true, open_feedback: true,
          selected_modules: true,
        },
      }),
      this.prisma.feedbackResponse.count({ where: { tenant_id: tenantId } }),
    ]);

    return {
      data,
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    };
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────

  async kpis(tenantId: string, period?: string) {
    const days = periodToDays(period);
    const since = new Date(Date.now() - days * 86_400_000);

    const [totalResponses, totalTokens, avgCsatRow, avgNpsRow, positiveCount, flaggedCount] =
      await Promise.all([
        this.prisma.feedbackResponse.count({
          where: { tenant_id: tenantId, created_at: { gte: since } },
        }),
        this.prisma.surveyToken.count({
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

    // Real NPS = %promoters - %detractors; we use avg as proxy when we don't have breakdown here
    // Response rate = responses / tokens sent
    const responseRate = totalTokens > 0 ? Math.round((totalResponses / totalTokens) * 100) : 0;
    const positiveSentiment = totalResponses > 0 ? Math.round((positiveCount / totalResponses) * 100) : 0;

    return {
      data: {
        avgCsat: avgCsat ? parseFloat(avgCsat.toFixed(1)) : 0,
        npsScore: Math.round(avgNps),
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
      SELECT DATE(created_at AT TIME ZONE 'UTC')::text as date,
             AVG(csat_score)::numeric(3,2) as avg_csat,
             AVG(nps_score)::numeric(5,2) as avg_nps,
             COUNT(*)::bigint as count
      FROM feedback_responses
      WHERE tenant_id = ${tenantId}::uuid
        AND created_at >= ${since}
      GROUP BY DATE(created_at AT TIME ZONE 'UTC')
      ORDER BY date ASC
    `;

    return {
      data: rows.map((r) => ({
        date: r.date,
        csat: r.avg_csat ? parseFloat(parseFloat(r.avg_csat).toFixed(1)) : 0,
        nps: r.avg_nps ? Math.round(parseFloat(r.avg_nps)) : 0,
        count: Number(r.count),
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
        promoterCount: promoters,
        passiveCount: passives,
        detractorCount: detractors,
        npsScore: Math.round(((promoters - detractors) / total) * 100),
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

    const themeMap = new Map<string, { count: number; sentiments: Record<string, number> }>();
    for (const r of rows) {
      if (!themeMap.has(r.theme)) themeMap.set(r.theme, { count: 0, sentiments: {} });
      const entry = themeMap.get(r.theme)!;
      entry.count += Number(r.count);
      entry.sentiments[r.sentiment] = (entry.sentiments[r.sentiment] || 0) + Number(r.count);
    }

    const data = Array.from(themeMap.entries())
      .map(([theme, info]) => {
        const dominantSentiment = Object.entries(info.sentiments)
          .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';
        return { theme, count: info.count, sentiment: dominantSentiment };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { data };
  }
}
