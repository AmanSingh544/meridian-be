import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class AiExtendedService {
  private readonly logger = new Logger(AiExtendedService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  // ── Ticket AI ─────────────────────────────────────────────────────────────

  async getSuggestion(ticketId: string, type: string) {
    const suggestionId = `sugg_${ticketId}_${type}`;

    // If the agent already acted on this suggestion, return early with the recorded status
    // so the frontend shows the resolved state and hides Accept/Reject buttons.
    const recentFeedback = await this.prisma.aiSuggestionFeedback.findFirst({
      where: {
        suggestion_id: suggestionId,
        action: { in: ['accepted', 'rejected'] },
        created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { created_at: 'desc' },
    });
    if (recentFeedback) {
      return { data: { id: suggestionId, type, suggestion: {}, confidence: 0, status: recentFeedback.action === 'accepted' ? 'accepted' : 'rejected' } };
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { comments: { take: 5, orderBy: { created_at: 'asc' } } },
    });

    if (!ticket) {
      return { data: { id: suggestionId, type, suggestion: {}, confidence: 0 } };
    }

    const content = `${ticket.title}\n${ticket.description ?? ''}`;
    let suggestion: any = {};
    let confidence = 0.8;

    if (type === 'classification') {
      const result = await this.aiService.classifyTicket(ticket.title, ticket.description ?? '');
      suggestion = { category: result.category, priority: result.priority };
      confidence = result.categoryConfidence ?? 0.8;
    } else if (type === 'summary') {
      const result = await this.aiService.summarizeTicket(content);
      suggestion = { summary: result.summary };
    } else if (type === 'reply') {
      const result = await this.aiService.generateReply(content, []);
      suggestion = { reply: result.reply };
    } else if (type === 'priority') {
      const result = await this.aiService.classifyTicket(ticket.title, ticket.description ?? '');
      suggestion = { priority: result.priority };
      confidence = result.priorityConfidence ?? 0.8;
    } else if (type === 'route') {
      const agents = await this.prisma.user.findMany({
        where: { tenant_id: ticket.tenant_id, role: { in: ['AGENT', 'LEAD'] as any } },
        include: { user_skills: { include: { skill: true } } },
      });
      const agentList = agents.map((a) => ({
        id: a.id,
        name: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email,
        skills: a.user_skills.map((us) => us.skill.name),
      }));
      // Build id→name lookup so we can enrich rankings without extra DB calls
      const agentNameMap = new Map(agentList.map((a) => [a.id, a.name]));

      const result = await this.aiService.suggestRoute(ticket.title, ticket.description ?? '', agentList);
      const rankings = result.rankings ?? [];
      const top = rankings[0];

      if (top) {
        suggestion = {
          agentId: top.agent_id,
          agentName: agentNameMap.get(top.agent_id) ?? top.agent_id,
          reason: top.reasoning,
          // Normalize LLM 0-100 integer to 0-1 float for frontend ConfidenceBar
          confidence: Math.min(1, (top.confidence ?? 0) / 100),
          alternativeAgents: rankings.slice(1, 3).map((r) => ({
            agentId: r.agent_id,
            agentName: agentNameMap.get(r.agent_id) ?? r.agent_id,
            confidence: Math.min(1, (r.confidence ?? 0) / 100),
          })),
        };
        // Envelope confidence mirrors the top suggestion's normalised value
        confidence = suggestion.confidence;
      }
    } else if (type === 'eta') {
      const ageHours = Math.floor((Date.now() - ticket.created_at.getTime()) / (1000 * 60 * 60));
      const commentCount = ticket.comments?.length ?? 0;

      // Fetch assignee workload so we can factor in how busy the assigned agent is
      let assigneeWorkload: { active_tickets: number; max_capacity: number } | null = null;
      if (ticket.assignee_id) {
        assigneeWorkload = await this.prisma.workload.findFirst({
          where: { user_id: ticket.assignee_id },
          select: { active_tickets: true, max_capacity: true },
        });
      }

      suggestion = await this.estimateETA(ticket, ageHours, commentCount, assigneeWorkload);
      confidence = suggestion.confidence;
    }

    return { data: { id: suggestionId, type, suggestion, confidence, status: 'pending' } };
  }

  private async estimateETA(
    ticket: any,
    ageHours: number,
    commentCount: number,
    assigneeWorkload?: { active_tickets: number; max_capacity: number } | null,
  ) {
    // Base hours by priority
    const baseHours: Record<string, number> = { URGENT: 4, HIGH: 8, MEDIUM: 24, LOW: 48 };
    const base = baseHours[(ticket.priority as string) ?? 'MEDIUM'] ?? 24;

    const factors: string[] = [`Priority: ${ticket.priority ?? 'MEDIUM'}`];

    // Complexity signal: longer description / more comments → more work
    const descLen = (ticket.description ?? '').length;
    let complexityMultiplier = 1;
    if (descLen > 500 || commentCount > 5) {
      complexityMultiplier = 1.5;
      factors.push('Complex issue (detailed description / active discussion)');
    } else if (descLen < 100 && commentCount === 0) {
      complexityMultiplier = 0.75;
      factors.push('Simple issue (brief description, no discussion yet)');
    }

    // Age signal: already been open a while → harder than average
    if (ageHours > base * 2) {
      complexityMultiplier *= 1.3;
      factors.push(`Already open ${Math.round(ageHours)} hours`);
    }

    // Workload signal: busier agent → longer queue wait
    if (assigneeWorkload) {
      const capacity = assigneeWorkload.max_capacity > 0 ? assigneeWorkload.max_capacity : 10;
      const utilization = assigneeWorkload.active_tickets / capacity;
      if (utilization > 0.8) {
        complexityMultiplier *= 1.4;
        factors.push(`Assigned agent at ${Math.round(utilization * 100)}% capacity`);
      } else if (utilization > 0.5) {
        complexityMultiplier *= 1.2;
        factors.push(`Assigned agent at ${Math.round(utilization * 100)}% capacity`);
      }
    }

    const estimatedHours = Math.round(base * complexityMultiplier);
    const range = { low: Math.round(estimatedHours * 0.6), high: Math.round(estimatedHours * 1.6) };
    const confidence = commentCount > 0 ? 0.75 : 0.6;

    return { estimatedHours, confidence, factors, range };
  }

  // ── AI Digest ─────────────────────────────────────────────────────────────

  async getDigest() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [overdueTickets, stalledTickets, recentTickets] = await Promise.all([
      // Tickets past SLA deadline with no resolution
      this.prisma.ticket.findMany({
        where: { status: { notIn: ['RESOLVED', 'CLOSED'] }, sla_deadline_at: { lt: now } },
        orderBy: { sla_deadline_at: 'asc' },
        take: 10,
        select: { id: true, ticket_number: true, title: true, sla_deadline_at: true, priority: true },
      }),
      // Open tickets with no update in 7+ days
      this.prisma.ticket.findMany({
        where: { status: { notIn: ['RESOLVED', 'CLOSED'] }, updated_at: { lt: sevenDaysAgo } },
        orderBy: { updated_at: 'asc' },
        take: 5,
        select: { id: true, ticket_number: true, title: true, updated_at: true },
      }),
      // Tickets created in the last 7 days for pattern detection
      this.prisma.ticket.findMany({
        where: { created_at: { gte: sevenDaysAgo } },
        orderBy: { created_at: 'desc' },
        take: 50,
        select: { id: true, category: true, tags: true, title: true },
      }),
    ]);

    const atRiskTickets = overdueTickets.map((t) => ({
      ticketId: t.id,
      ticketNumber: t.ticket_number,
      title: t.title,
      reason: 'Past due date with no resolution',
      urgency: (t.priority === 'URGENT' || t.priority === 'HIGH' ? 'high' : 'medium') as 'high' | 'medium',
      deadlineAt: t.sla_deadline_at?.toISOString(),
    }));

    const responseGaps = stalledTickets.map((t) => ({
      ticketId: t.id,
      ticketNumber: t.ticket_number,
      title: t.title,
      waitingDays: Math.floor((now.getTime() - t.updated_at.getTime()) / (1000 * 60 * 60 * 24)),
      waitingFor: 'agent' as const,
    }));

    // Group recent tickets by category for pattern detection
    const categoryCount = new Map<string, { count: number; ids: string[] }>();
    for (const t of recentTickets) {
      const cat = (t.category as string) || 'UNCATEGORISED';
      if (!categoryCount.has(cat)) categoryCount.set(cat, { count: 0, ids: [] });
      const entry = categoryCount.get(cat)!;
      entry.count++;
      entry.ids.push(t.id);
    }

    const patterns = [...categoryCount.entries()]
      .filter(([, v]) => v.count >= 2)
      .map(([label, v]) => ({
        label,
        ticketCount: v.count,
        tags: [],
        suggestion: `${v.count} tickets in category "${label}" this week — consider a KB article or proactive outreach.`,
      }));

    const needsAttentionCount = atRiskTickets.length + responseGaps.length;

    return {
      data: {
        generatedAt: now.toISOString(),
        needsAttentionCount,
        needsAttentionSummary:
          needsAttentionCount === 0
            ? 'All tickets are on track.'
            : `${atRiskTickets.length} ticket${atRiskTickets.length !== 1 ? 's' : ''} past due, ${responseGaps.length} stalled for 7+ days.`,
        atRiskTickets,
        patterns,
        responseGaps,
        digestSummary: `Digest generated at ${now.toISOString().slice(0, 10)}. ${needsAttentionCount} items need attention.`,
      },
    };
  }

  async classifyText(dto: { title: string; description?: string }) {
    const result = await this.aiService.classifyTicket(dto.title, dto.description ?? dto.title);
    return {
      data: {
        category: result.category,
        priority: result.priority,
        categoryConfidence: result.categoryConfidence,
        priorityConfidence: result.priorityConfidence,
        categoryReasoning: result.categoryReasoning,
        priorityReasoning: result.priorityReasoning,
        priorityFactors: result.priorityFactors,
      },
    };
  }

  async semanticSearch(query: string, scope?: string) {
    // Embedding generated but vector store not yet wired — fall back to keyword search
    const words = query.trim().split(/\s+/).filter((w) => w.length > 2).slice(0, 5);
    if (!words.length) return { data: [] };

    const where: any = {
      OR: [
        ...words.map((w) => ({ title: { contains: w, mode: 'insensitive' } })),
        ...words.map((w) => ({ description: { contains: w, mode: 'insensitive' } })),
      ],
    };
    if (scope === 'kb') {
      const articles = await this.prisma.kbArticle.findMany({
        where: { status: 'published', OR: words.map((w) => ({ title: { contains: w, mode: 'insensitive' as const } })) },
        orderBy: { view_count: 'desc' },
        take: 10,
        select: { id: true, title: true, excerpt: true },
      });
      return { data: articles.map((a) => ({ type: 'kb', id: a.id, title: a.title, excerpt: a.excerpt })) };
    }

    const tickets = await this.prisma.ticket.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      take: 10,
      select: { id: true, title: true, status: true, priority: true },
    });
    return { data: tickets.map((t) => ({ type: 'ticket', id: t.id, title: t.title, status: t.status, priority: t.priority })) };
  }

  async acceptSuggestion(id: string, agentId?: string) {
    // Suggestion ids are encoded as sugg_{ticketId}_{type}
    const parts = id.split('_');
    const type = parts[parts.length - 1];
    const ticketId = parts.slice(1, parts.length - 1).join('_');

    await Promise.all([
      // Persist acceptance so we have an audit trail
      this.prisma.aiSuggestionFeedback.create({
        data: { suggestion_id: id, ticket_id: ticketId, type, action: 'accepted', agent_id: agentId ?? null },
      }),
      // For routing suggestions, actually assign the ticket
      type === 'route' && agentId && ticketId
        ? this.prisma.ticket.update({ where: { id: ticketId }, data: { assignee_id: agentId } })
        : Promise.resolve(),
    ]);

    return { success: true };
  }

  async rejectSuggestion(id: string, reason?: string) {
    const parts = id.split('_');
    const type = parts[parts.length - 1];
    const ticketId = parts.slice(1, parts.length - 1).join('_');

    await this.prisma.aiSuggestionFeedback.create({
      data: { suggestion_id: id, ticket_id: ticketId, type, action: 'rejected', reason: reason ?? null },
    });

    return { success: true };
  }

  // ── KB AI ─────────────────────────────────────────────────────────────────

  async getKbSuggestions(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return { data: [] };

    const articles = await this.prisma.kbArticle.findMany({
      where: {
        tenant_id: ticket.tenant_id,
        status: 'published',
        OR: [{ title: { contains: ticket.title.split(' ')[0], mode: 'insensitive' } }],
      },
      take: 5,
      orderBy: { view_count: 'desc' },
      select: { id: true, title: true, excerpt: true },
    });

    const suggestions = articles.map((a) => ({
      articleId: a.id,
      title: a.title,
      excerpt: a.excerpt ?? '',
      score: 0.75,
      reasoning: 'Matched on ticket title keywords',
    }));

    return { data: suggestions };
  }

  async getKbDeflections(query: string, limit = 5) {
  //  if (!query?.trim()) return { data: [] };

    const words = query.trim().split(/\s+/).slice(0, 3);
    const articles = await this.prisma.kbArticle.findMany({
      where: {
        status: 'published',
        OR: words.map((w) => ({ title: { contains: w, mode: 'insensitive' as const } })),
      },
      take: limit,
      orderBy: { view_count: 'desc' },
      select: { id: true, title: true, excerpt: true },
    });

    const deflections = articles.map((a) => ({
      articleId: a.id,
      title: a.title,
      excerpt: a.excerpt ?? '',
      score: 0.7,
      reasoning: 'Matched query keywords',
    }));

    return { data: deflections };
  }

  async generateKbDraft(dto: { topic: string; context?: string; categoryId?: string; tone?: string }) {
    const result = await this.aiService.generateKbDraft(dto.topic, dto.context);
    return {
      data: {
        title: result.title,
        excerpt: (result.content as string)?.split('\n').find((l: string) => l.trim()) ?? '',
        content: result.content,
        suggestedTags: [dto.topic.split(' ')[0]?.toLowerCase()].filter(Boolean),
        suggestedCategoryId: dto.categoryId,
      },
    };
  }

  async getKbGaps() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find recurring ticket categories that have no matching KB article
    const recentTickets = await this.prisma.ticket.findMany({
      where: { created_at: { gte: sevenDaysAgo } },
      select: { id: true, title: true, category: true },
    });

    const categoryMap = new Map<string, { count: number; ids: string[]; sampleTitle: string }>();
    for (const t of recentTickets) {
      const cat = (t.category as string) || 'GENERAL';
      if (!categoryMap.has(cat)) categoryMap.set(cat, { count: 0, ids: [], sampleTitle: t.title });
      const e = categoryMap.get(cat)!;
      e.count++;
      e.ids.push(t.id);
    }

    const gaps = [...categoryMap.entries()]
      .filter(([, v]) => v.count >= 2)
      .map(([cat, v], idx) => ({
        id: `gap_${idx}`,
        topic: cat,
        description: `${v.count} tickets in the last 7 days relate to "${cat}" with no dedicated KB article.`,
        ticketCount: v.count,
        sampleTicketIds: v.ids.slice(0, 3),
        suggestedTitle: `How to resolve ${cat.toLowerCase().replace(/_/g, ' ')} issues`,
        priority: (v.count >= 5 ? 'high' : v.count >= 3 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      }));

    return { data: gaps };
  }

  async askKb(dto: { question: string; articleId?: string; tenant_id?: string }) {
    let articles: Array<{ id: string; title: string; content: string }> = [];

    if (dto.articleId) {
      const article = await this.prisma.kbArticle.findUnique({
        where: { id: dto.articleId },
        select: { id: true, title: true, content: true },
      });
      if (article) articles = [article];
    } else {
      // Keyword search across title + content using all meaningful words
      const words = (dto.question ?? '').split(/\s+/).filter((w) => w.length > 2).slice(0, 5);
      articles = await this.prisma.kbArticle.findMany({
        where: {
          status: 'published',
          OR: [
            ...words.map((w) => ({ title:   { contains: w, mode: 'insensitive' as const } })),
            ...words.map((w) => ({ content: { contains: w, mode: 'insensitive' as const } })),
          ],
        },
        orderBy: { view_count: 'desc' },
        take: 4,
        select: { id: true, title: true, content: true },
      });
    }

    // Full RAG pipeline: chunk → rank → cite
    const result = await this.aiService.generateReply(dto.question, articles, 'helpful');

    return {
      data: {
        answer: result.reply,
        confidence: articles.length > 0 ? 0.82 : 0.4,
        sourceArticleIds: result.sources.map((s) => s.id).filter(Boolean),
        followUpQuestions: [],
        cannotAnswer: !result.reply || result.reply.trim().length < 10,
      },
    };
  }

  // ── Project AI ────────────────────────────────────────────────────────────

  async getProjectHealth(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return {
        data: {
          projectId, color: 'red', score: 0, explanation: 'Project not found.',
          velocityTrend: 'stable', slaBreachRisk: 0, openBlockers: 0,
          generatedAt: new Date().toISOString(),
        },
      };
    }

    const [openCount, slaBreachedCount] = await Promise.all([
      this.prisma.ticket.count({ where: { tenant_id: project.tenant_id, project_id: projectId, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      this.prisma.ticket.count({ where: { tenant_id: project.tenant_id, project_id: projectId, status: { notIn: ['RESOLVED', 'CLOSED'] }, sla_deadline_at: { lt: new Date() } } }),
    ]);
    const perWeek = await this.weeklyDeltas(project.tenant_id, projectId);
    const avg = perWeek.reduce((a, b) => a + b, 0) / perWeek.length;
    const velocity = Math.max(1, Math.round(avg));

    // Normalised score: each signal clamped to [0,1] before weighting → always 0–100
    const normOpen = Math.min(1, openCount / 20);
    const normSla = Math.min(1, slaBreachedCount / 5);
    const normVelocity = Math.min(1, velocity / 10);
    const score = Math.round(Math.max(0, (1 - (normOpen * 0.4 + normSla * 0.4) + normVelocity * 0.2) * 100));
    const color = score >= 80 ? 'green' : score >= 50 ? 'amber' : 'red';

    // Slope-based trend: most-recent window vs previous
    const velocityTrend: 'improving' | 'stable' | 'declining' =
      perWeek[0] > perWeek[1] ? 'improving' : perWeek[0] < perWeek[1] ? 'declining' : 'stable';
    const explanation = `Project health score is ${score}/100. ${openCount} open tickets, ${slaBreachedCount} SLA breached. Velocity: ${velocity} tickets/week.`;

    return {
      data: {
        projectId, color, score, explanation, velocityTrend,
        slaBreachRisk: Math.min(1, slaBreachedCount / Math.max(openCount, 1)),
        openBlockers: slaBreachedCount,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async getProjectClusters(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return { data: [] };

    const tickets = await this.prisma.ticket.findMany({
      where: { tenant_id: project.tenant_id, project_id: projectId, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      select: { id: true, title: true, tags: true, category: true },
      orderBy: { updated_at: 'desc' },
      take: 100,
    });

    // Group by category/tag as a lightweight cluster proxy
    const byCategory: Record<string, typeof tickets> = {};
    for (const t of tickets) {
      const key = (t.category as string) || 'Uncategorised';
      (byCategory[key] = byCategory[key] ?? []).push(t);
    }
    const clusters = Object.entries(byCategory).map(([label, ts], i) => ({
      id: `cluster_${i}`,
      label,
      ticketCount: ts.length,
      ticketIds: ts.map((t) => t.id),
      topKeywords: [...new Set(ts.flatMap((t) => (t.tags as string[]) ?? []))].slice(0, 5),
      sentiment: ts.length > 5 ? 'negative' : ts.length > 2 ? 'neutral' : 'positive',
    }));

    return { data: clusters };
  }

  async getProjectScopeDrift(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return { data: [] };

    const meta = (project.metadata ?? {}) as any;
    const scope: string = meta.scope ?? '';
    if (!scope) return { data: [] };

    const tickets = await this.prisma.ticket.findMany({
      where: { tenant_id: project.tenant_id, project_id: projectId, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      select: { id: true, title: true, description: true, tags: true },
      orderBy: { updated_at: 'desc' },
      take: 50,
    });

    const scopeWords = new Set(scope.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    const flags = tickets.map((t) => {
      const ticketWordSet = new Set(
        (t.title + ' ' + (t.description ?? '')).toLowerCase().split(/\W+/).filter((w) => w.length > 3),
      );
      // Jaccard similarity: balanced regardless of scope or ticket length
      const intersection = [...ticketWordSet].filter((w) => scopeWords.has(w)).length;
      const union = new Set([...ticketWordSet, ...scopeWords]).size;
      const similarity = union === 0 ? 0 : intersection / union;
      const flagged = similarity < 0.08;
      return {
        ticketId: t.id,
        ticketTitle: t.title,
        similarity: parseFloat(similarity.toFixed(3)),
        flagged,
        reasoning: flagged
          ? `Ticket shares few keywords with project scope statement (similarity: ${(similarity * 100).toFixed(0)}%).`
          : `Ticket aligns with project scope (similarity: ${(similarity * 100).toFixed(0)}%).`,
      };
    }).filter((f) => f.flagged).slice(0, 20);

    return { data: flags };
  }

  async getProjectChurnRisk(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return { data: { projectId, score: 0, level: 'low', signals: [], recommendation: 'Project not found.' } };
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [slaBreached, escalations, recentOpen] = await Promise.all([
      this.prisma.ticket.count({
        where: { tenant_id: project.tenant_id, project_id: projectId, status: { notIn: ['RESOLVED', 'CLOSED'] }, sla_deadline_at: { lt: now } },
      }),
      this.prisma.ticket.count({
        where: { tenant_id: project.tenant_id, project_id: projectId, priority: { in: ['URGENT', 'HIGH'] }, created_at: { gte: sevenDaysAgo } },
      }),
      this.prisma.ticket.count({
        where: { tenant_id: project.tenant_id, project_id: projectId, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      }),
    ]);

    const signals: string[] = [];
    if (slaBreached > 0) signals.push(`${slaBreached} ticket(s) have breached SLA`);
    if (escalations > 2) signals.push(`${escalations} high-priority tickets raised in the last 7 days`);
    if (recentOpen > 10) signals.push(`${recentOpen} open tickets with no resolution`);
    if ((project.health_score ?? 100) < 60) signals.push('Project health score is below 60');

    // Normalise each signal to [0,1] before weighting so the total stays in [0,1]
    const normSla = Math.min(1, slaBreached / 5);
    const normEscalations = Math.min(1, escalations / 5);
    const normBacklog = Math.min(1, recentOpen / 20);
    const score = normSla * 0.4 + normEscalations * 0.3 + normBacklog * 0.3;
    const level = score > 0.6 ? 'high' : score > 0.3 ? 'medium' : 'low';
    const recommendation = level === 'high'
      ? 'Immediate client check-in recommended. Prioritise SLA resolution.'
      : level === 'medium'
      ? 'Monitor closely. Consider proactive status update to client.'
      : 'Engagement is healthy. Continue current cadence.';

    return { data: { projectId, score: parseFloat(score.toFixed(3)), level, signals, recommendation } };
  }

  async getProjectNextAction(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return { data: { projectId, action: 'Project not found', reason: '', urgency: 'low' } };
    }

    const now = new Date();
    const [slaBreached, highPriority, overallOpen] = await Promise.all([
      this.prisma.ticket.findFirst({
        where: { tenant_id: project.tenant_id, project_id: projectId, status: { notIn: ['RESOLVED', 'CLOSED'] }, sla_deadline_at: { lt: now } },
        select: { id: true, title: true },
      }),
      this.prisma.ticket.findFirst({
        where: { tenant_id: project.tenant_id, project_id: projectId, status: { notIn: ['RESOLVED', 'CLOSED'] }, priority: { in: ['URGENT', 'HIGH'] } },
        orderBy: { created_at: 'asc' },
        select: { id: true, title: true },
      }),
      this.prisma.ticket.count({
        where: { tenant_id: project.tenant_id, project_id: projectId, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      }),
    ]);

    let action: string;
    let reason: string;
    let urgency: 'high' | 'medium' | 'low';
    let draftMessage: string | undefined;

    if (slaBreached) {
      action = `Resolve SLA-breached ticket: "${slaBreached.title}"`;
      reason = 'This ticket has passed its SLA deadline and is at risk of a breach penalty.';
      urgency = 'high';
      draftMessage = `Hi team, ticket "${slaBreached.title}" has breached its SLA. Please prioritise immediately.`;
    } else if (highPriority && overallOpen > 3) {
      action = `Address high-priority ticket: "${highPriority.title}"`;
      reason = 'High-priority tickets directly impact client satisfaction and there are 3+ open tickets pending.';
      urgency = 'medium';
    } else if (overallOpen > 5) {
      action = `Review and triage ${overallOpen} open tickets`;
      reason = 'A backlog of open tickets may delay project milestones.';
      urgency = 'medium';
    } else if (highPriority) {
      action = `Address high-priority ticket: "${highPriority.title}"`;
      reason = 'High-priority ticket requires attention even with a small backlog.';
      urgency = 'medium';
    } else {
      action = 'Send a proactive status update to the client';
      reason = 'No immediate blockers detected. Maintaining communication builds trust.';
      urgency = 'low';
      draftMessage = `Hi, just a quick update — ${project.name} is progressing well with no current blockers. We will keep you posted.`;
    }

    return { data: { projectId, action, reason, urgency, ...(draftMessage ? { draftMessage } : {}) } };
  }

  async getProjectStatusReport(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return { data: null };

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Tickets belonging to this project's tenant, resolved this week
    const [resolvedThisWeek, openTickets] = await Promise.all([
      this.prisma.ticket.count({
        where: {
          tenant_id: project.tenant_id,
          project_id: projectId,
          status: { in: ['RESOLVED', 'CLOSED'] },
          updated_at: { gte: weekAgo },
        },
      }),
      this.prisma.ticket.findMany({
        where: {
          tenant_id: project.tenant_id,
          project_id: projectId,
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        },
        orderBy: { priority: 'desc' },
        take: 20,
        select: { id: true, title: true, priority: true, status: true, sla_deadline_at: true },
      }),
    ]);

    const meta = (project.metadata ?? {}) as any;
    const milestones: any[] = meta.milestones ?? [];
    const overdueMilestones = milestones.filter(
      (m: any) => !m.isCompleted && m.dueDate && new Date(m.dueDate) < now,
    );
    const nextMilestone = milestones.find((m: any) => !m.isCompleted);

    // Derive blockers from overdue / SLA-breached tickets
    const slaBreached = openTickets.filter(
      (t) => t.sla_deadline_at && new Date(t.sla_deadline_at) < now,
    );
    const blockers: string[] = [
      ...overdueMilestones.map((m: any) => `${m.id} (${m.title}) is past its scheduled date`),
      ...slaBreached.slice(0, 2).map((t) => `${t.title} has breached its SLA`),
    ];

    // Next steps: incomplete milestones + high-priority open tickets
    const highPriorityOpen = openTickets.filter((t) => t.priority === 'HIGH' || t.priority === 'URGENT');
    const nextSteps: string[] = [
      ...(nextMilestone ? [`Progress ${nextMilestone.title} milestone`] : []),
      ...highPriorityOpen.slice(0, 2).map((t) => `Resolve high-priority ticket: ${t.title}`),
      openTickets.length > 5 ? `Address ${openTickets.length} open tickets this week` : '',
    ].filter(Boolean);

    const onTrack = overdueMilestones.length === 0 && slaBreached.length === 0;

    // Confidence derived from live signals, not the stale stored health_score field
    const confidenceScore = Math.max(0, Math.min(1,
      1 - (overdueMilestones.length * 0.2) - (slaBreached.length * 0.1),
    ));
    const confidencePct = Math.round(confidenceScore * 100);

    // Build period string
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const period = `${fmt(weekAgo)} – ${fmt(now)}`;

    const milestoneConfidence = nextMilestone
      ? `${confidencePct}% confident that the "${nextMilestone.title}" milestone will be delivered${nextMilestone.dueDate ? ` by ${new Date(nextMilestone.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''} if current velocity is maintained.`
      : 'All milestones completed.';

    // Summary narrative
    const summary = [
      `The team resolved ${resolvedThisWeek} ticket${resolvedThisWeek !== 1 ? 's' : ''} this week across ${project.name}.`,
      openTickets.length > 0 ? `${openTickets.length} tickets remain open.` : 'No open tickets.',
      onTrack ? 'The project is on track.' : `${overdueMilestones.length > 0 ? `${overdueMilestones.length} milestone(s) are overdue. ` : ''}${slaBreached.length > 0 ? `${slaBreached.length} ticket(s) have breached SLA.` : ''}`.trim(),
    ].join(' ');

    return {
      data: {
        projectId: project.id,
        period,
        summary,
        resolvedThisWeek,
        openCount: openTickets.length,
        blockers,
        nextSteps: nextSteps.length ? nextSteps : ['Continue current sprint and monitor open tickets'],
        onTrack,
        milestoneConfidence,
        riskSummary: blockers.length > 0
          ? `Key risks identified: ${blockers.length} issue(s) require attention.`
          : 'No major risks identified.',
        generatedAt: now.toISOString(),
      },
    };
  }

  // 4-week rolling average: each bucket is an independent time window (no subtraction hacks)
  private async rollingVelocity(tenantId: string, projectId?: string): Promise<number> {
    const weeks = await this.weeklyDeltas(tenantId, projectId);
    const avg = weeks.reduce((a, b) => a + b, 0) / weeks.length;
    return Math.max(1, Math.round(avg));
  }

  private async weeklyDeltas(tenantId: string, projectId?: string): Promise<number[]> {
    const now = new Date();
    const DAY = 24 * 60 * 60 * 1000;
    const base: any = {
      tenant_id: tenantId,
      ...(projectId ? { project_id: projectId } : {}),
      status: { in: ['RESOLVED', 'CLOSED'] as any[] },
    };
    // Each bucket: [i*7d ago → (i+1)*7d ago], fully independent windows
    return Promise.all(
      [0, 1, 2, 3].map((i) =>
        this.prisma.ticket.count({
          where: {
            ...base,
            updated_at: {
              gte: new Date(now.getTime() - (i + 1) * 7 * DAY),
              lt: new Date(now.getTime() - i * 7 * DAY),
            },
          },
        }),
      ),
    );
  }

  async getProjectMilestonePredictions(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return { data: [] };

    const meta = (project.metadata ?? {}) as any;
    const milestones: any[] = meta.milestones ?? [];
    const incomplete = milestones.filter((m: any) => !m.isCompleted && m.dueDate);
    if (!incomplete.length) return { data: [] };

    const now = new Date();
    const DAY = 24 * 60 * 60 * 1000;

    // Rolling velocity scoped to this project
    const velocity = await this.rollingVelocity(project.tenant_id, projectId);

    // Project-level open count from metadata (seeded per project) as a fallback signal
    const projectOpenCount: number = meta.openTicketCount ?? 0;

    // Fetch open tickets for this project
    const tenantOpenTickets = await this.prisma.ticket.findMany({
      where: { tenant_id: project.tenant_id, project_id: projectId, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      select: { id: true, title: true, tags: true, sla_deadline_at: true },
      orderBy: { updated_at: 'desc' },
      take: 200,
    });

    const predictions = incomplete.map((m: any) => {
      const scheduled = new Date(m.dueDate);

      // Per-milestone open ticket count: use metadata field if present, else estimate
      // from the milestone's fraction of the total project scope
      const milestoneOpenTickets: number =
        m.openTickets ??
        (incomplete.length > 0 ? Math.round(projectOpenCount / incomplete.length) : 0);

      // estimatedTickets allows seed/API callers to set effort weight per milestone
      const estimatedTickets: number = m.estimatedTickets ?? Math.max(milestoneOpenTickets, 5);

      // Weeks needed = open tickets for this milestone / velocity
      const weeksNeeded = milestoneOpenTickets > 0 ? milestoneOpenTickets / velocity : 0;
      const delayDays = Math.round(weeksNeeded * 7);

      const predicted = new Date(scheduled.getTime() + delayDays * DAY);

      // Confidence interval scales with uncertainty: wider when more tickets remain
      const variance = Math.max(2, Math.round(weeksNeeded * 2));
      const confidenceLow = new Date(predicted.getTime() - variance * DAY);
      const confidenceHigh = new Date(predicted.getTime() + variance * DAY);

      const onTrack = predicted <= scheduled;

      // Find blocking tickets: open tickets whose title/tags reference this milestone id or name
      const milestoneLabel = (m.title ?? '').toLowerCase();
      const milestoneId = (m.id ?? '').toLowerCase();
      const blockingTicketIds = tenantOpenTickets
        .filter((t) => {
          const inTitle = t.title.toLowerCase().includes(milestoneLabel) || t.title.toLowerCase().includes(milestoneId);
          const inTags = (t.tags ?? []).some(
            (tag: string) => tag.toLowerCase().includes(milestoneLabel) || tag.toLowerCase() === milestoneId,
          );
          const slaBreached = t.sla_deadline_at && new Date(t.sla_deadline_at) < now;
          return inTitle || inTags || slaBreached;
        })
        .slice(0, 5)
        .map((t) => t.id);

      const reasoning = onTrack
        ? `Rolling velocity: ${velocity} ticket(s)/week. ${milestoneOpenTickets} open ticket(s) for this milestone — on track for scheduled date.`
        : `Rolling velocity: ${velocity} ticket(s)/week. ${milestoneOpenTickets} open ticket(s) for this milestone require ~${delayDays} more day(s) beyond the scheduled date (${estimatedTickets} total estimated). Clearing blockers will pull this back.`;

      // Smooth risk score: no step jumps, each signal normalised to [0,1]
      const riskScore =
        Math.min(1, delayDays / 14) * 0.5 +
        Math.min(1, blockingTicketIds.length / 5) * 0.3 +
        (velocity < 2 ? 0.2 : 0);
      const riskLevel: 'high' | 'medium' | 'low' =
        riskScore > 0.7 ? 'high' : riskScore > 0.4 ? 'medium' : 'low';

      return {
        milestoneId: m.id,
        milestoneName: m.title,
        scheduledDate: scheduled.toISOString(),
        predictedDate: predicted.toISOString(),
        onTrack,
        riskLevel,
        confidenceLow: confidenceLow.toISOString(),
        confidenceHigh: confidenceHigh.toISOString(),
        blockingTicketIds,
        reasoning,
      };
    });

    return { data: predictions };
  }

  async askProject(projectId: string, dto: { question: string }) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return { data: { answer: 'Project not found.', confidence: 0, sourceTicketIds: [], cannotAnswer: true } };

    const question = (dto.question ?? '').trim();
    if (!question) return { data: { answer: '', confidence: 0, sourceTicketIds: [], cannotAnswer: true } };

    // Pull relevant tickets as context for the answer
    const keywords = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
    const tickets = await this.prisma.ticket.findMany({
      where: {
        tenant_id: project.tenant_id,
        project_id: projectId,
        ...(keywords.length
          ? {
              OR: [
                ...keywords.map((k) => ({ title: { contains: k, mode: 'insensitive' as const } })),
                ...keywords.map((k) => ({ description: { contains: k, mode: 'insensitive' as const } })),
              ],
            }
          : {}),
      },
      orderBy: { updated_at: 'desc' },
      take: 5,
      select: { id: true, title: true, description: true, status: true, priority: true },
    });

    const meta = (project.metadata ?? {}) as any;
    const projectContext = [
      `Project: ${project.name}`,
      project.description ? `Description: ${project.description}` : '',
      `Status: ${project.status}`,
      meta.scope ? `Scope: ${meta.scope}` : '',
      tickets.length
        ? `Relevant tickets:\n${tickets.map((t) => `- [${t.status}] ${t.title}: ${(t.description ?? '').slice(0, 200)}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const result = await this.aiService.generateReply(question, projectContext, 'helpful');

    const cannotAnswer = !result.reply || result.reply.trim().length < 10;

    return {
      data: {
        answer: result.reply ?? 'I could not find enough information to answer this question.',
        confidence: tickets.length > 0 ? 0.78 : 0.4,
        sourceTicketIds: tickets.map((t) => t.id),
        cannotAnswer,
      },
    };
  }

  // ── Delivery AI ───────────────────────────────────────────────────────────

  private static readonly DELIVERY_WEIGHTS = {
    deadline: 0.45,
    priority: 0.25,
    status: 0.20,
    stagnation: 0.10,
  } as const;

  private static readonly PRIORITY_RISK: Record<string, number> = {
    URGENT: 1, HIGH: 0.8, MEDIUM: 0.5, LOW: 0.3,
  };

  private static readonly PRIORITY_BASE: Record<string, number> = {
    URGENT: 1, HIGH: 0.75, MEDIUM: 0.5, LOW: 0.25,
  };

  private deliveryClamp(v: number, min = 0, max = 1) {
    return Math.max(min, Math.min(max, v));
  }

  private computeDeliveryRisk(f: {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: Date | null;
    updated_at: Date;
  }, now: number) {
    const DAY = 1000 * 60 * 60 * 24;
    const status = f.status?.toUpperCase();
    const priority = f.priority?.toUpperCase();

    const days = f.due_date ? (f.due_date.getTime() - now) / DAY : null;

    // Exponential decay: urgency ramps smoothly, no hard cliff at day 14
    const deadlineRisk =
      days === null ? 0.3 : days < 0 ? 1 : this.deliveryClamp(Math.exp(-days / 7));

    const pRisk = AiExtendedService.PRIORITY_RISK[priority] ?? 0.5;

    const statusRisk = status === 'BLOCKED' ? 1 : status === 'IN_PROGRESS' ? 0.6 : 0.3;

    // 14-day window: only genuinely stale items (2+ weeks untouched) reach full risk
    const stagnationDays = (now - f.updated_at.getTime()) / DAY;
    const stagnationRisk = this.deliveryClamp(stagnationDays / 14);

    const w = AiExtendedService.DELIVERY_WEIGHTS;
    const score = this.deliveryClamp(
      w.deadline   * deadlineRisk +
      w.priority   * pRisk +
      w.status     * statusRisk +
      w.stagnation * stagnationRisk,
    );

    const level: 'HIGH' | 'MEDIUM' | 'LOW' =
      score > 0.75 ? 'HIGH' : score > 0.5 ? 'MEDIUM' : 'LOW';

    // Reason derived from dominant factor, not fixed if/else order
    const factors = { deadline: deadlineRisk, priority: pRisk, status: statusRisk, stagnation: stagnationRisk };
    const dominant = (Object.entries(factors).sort((a, b) => b[1] - a[1])[0][0]) as keyof typeof factors;

    let reason: string;
    if (dominant === 'deadline' && days !== null && days < 0) {
      reason = `Overdue by ${Math.abs(Math.floor(days))} day${Math.abs(Math.floor(days)) !== 1 ? 's' : ''}`;
    } else if (dominant === 'status' && status === 'BLOCKED') {
      reason = 'Blocked — requires immediate attention';
    } else if (dominant === 'deadline' && days !== null) {
      reason = `ETA in ${Math.ceil(days)} day${Math.ceil(days) !== 1 ? 's' : ''} — deadline approaching`;
    } else if (dominant === 'stagnation') {
      reason = `No updates in ${Math.floor(stagnationDays)} days — may be stalled`;
    } else {
      reason = level === 'LOW' ? 'Stable delivery trajectory' : 'Elevated risk across multiple signals';
    }

    const recommendation =
      level === 'HIGH' ? 'Escalate, reduce scope, or reassign resources' :
      level === 'MEDIUM' ? 'Review in next standup and monitor closely' :
      'No immediate action required';

    this.logger.debug('delivery_risk_computed', {
      featureId: f.id,
      score: parseFloat(score.toFixed(3)),
      factors: { deadlineRisk, pRisk, statusRisk, stagnationRisk },
      dominant,
      level,
    });

    return { score, level, reason, recommendation, daysUntilEta: days !== null ? Math.floor(days) : undefined };
  }

  async getDeliveryRisk() {
    const now = Date.now();
    const features = await this.prisma.deliveryItem.findMany({
      where: { status: { notIn: ['DONE', 'CANCELLED'] as any } },
      orderBy: { due_date: 'asc' },
      take: 20,
      select: { id: true, title: true, status: true, due_date: true, priority: true, updated_at: true },
    });

    const risks = features
      .map((f) => {
        const { score, level, reason, recommendation, daysUntilEta } = this.computeDeliveryRisk(f, now);
        return { featureId: f.id, featureTitle: f.title, riskLevel: level, riskScore: parseFloat(score.toFixed(3)), reason, daysUntilEta, recommendation };
      })
      .filter((f) => f.riskLevel !== 'LOW')
      .sort((a, b) => b.riskScore - a.riskScore);

    return { data: risks };
  }

  async prioritiseDelivery() {
    const now = Date.now();
    const features = await this.prisma.deliveryItem.findMany({
      where: { status: { notIn: ['DONE', 'CANCELLED'] as any } },
      select: { id: true, title: true, status: true, priority: true, due_date: true, updated_at: true },
    });

    const DAY = 1000 * 60 * 60 * 24;

    const scored = features.map((f) => {
      const status = f.status?.toUpperCase();
      const base = AiExtendedService.PRIORITY_BASE[f.priority?.toUpperCase()] ?? 0.5;

      let urgency = 1;
      if (f.due_date) {
        const days = (f.due_date.getTime() - now) / DAY;
        if (days < 0) urgency = 1.5;
        else if (days < 7) urgency = 1.3;
        else if (days < 14) urgency = 1.1;
      }

      const statusBoost = status === 'BLOCKED' ? 1.2 : status === 'IN_PROGRESS' ? 1.1 : 1;

      // Stagnation boost: long-idle items surface so they get actioned or closed
      const stagnationDays = (now - f.updated_at.getTime()) / DAY;
      const stagnationBoost = this.deliveryClamp(1 + stagnationDays / 14);

      const score = this.deliveryClamp(base * urgency * statusBoost * stagnationBoost);
      const displayScore = Math.round(score * 100);

      return {
        featureId: f.id,
        featureTitle: f.title,
        suggestedStatus: score > 0.6 ? 'IN_PROGRESS' : 'BACKLOG',
        score: displayScore,
        reasoning:
          displayScore >= 85 ? 'Critical — act immediately' :
          displayScore >= 60 ? 'High priority for current sprint' :
          'Can be scheduled later',
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return { data: scored };
  }

  async draftFeature(dto: { description?: string; topic?: string; context?: string }) {
    const topic = dto.description ?? dto.topic ?? 'new feature';
    const result = await this.aiService.generateKbDraft(topic, dto.context);

    const now = new Date();
    const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;

    return {
      data: {
        description: result.content || result.title,
        suggestedQuarter: quarter,
        suggestedCategory: 'FEATURE_REQUEST',
        suggestedAssigneeRole: 'LEAD',
      },
    };
  }

  // ── Onboarding AI ─────────────────────────────────────────────────────────

  async getOnboardingHealth(tenantId: string) {
    const items = await this.prisma.onboardingItem.findMany({
      where: { tenant_id: tenantId },
      select: { status: true, due_date: true },
    });

    if (!items.length) {
      return {
        data: {
          onboardingId: tenantId,
          health: 'ON_TRACK',
          confidence: 0.5,
          reason: 'No onboarding tasks found.',
          predictedGoLive: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          daysVariance: 0,
        },
      };
    }

    const now = new Date();
    const blocked = items.filter((i) => i.status === 'blocked').length;
    const overdue = items.filter((i) => i.due_date && new Date(i.due_date) < now && i.status !== 'done').length;
    const done = items.filter((i) => i.status === 'done').length;
    const total = items.length;

    let health: 'ON_TRACK' | 'AT_RISK' | 'BLOCKED' = 'ON_TRACK';
    let daysVariance = 0;
    let reason = 'Onboarding is progressing on schedule.';

    if (blocked > 0) {
      health = 'BLOCKED';
      daysVariance = blocked * 3;
      reason = `${blocked} task${blocked !== 1 ? 's' : ''} blocked — immediate action required.`;
    } else if (overdue > 0) {
      health = 'AT_RISK';
      daysVariance = overdue * 2;
      reason = `${overdue} task${overdue !== 1 ? 's' : ''} past due date — go-live may slip.`;
    } else if (done / total >= 0.9) {
      reason = 'Nearly complete — on track for go-live.';
    }

    const predictedGoLive = new Date(Date.now() + (30 + daysVariance) * 24 * 60 * 60 * 1000);
    const confidence = blocked > 0 ? 0.9 : overdue > 0 ? 0.75 : 0.85;

    return {
      data: {
        onboardingId: tenantId,
        health,
        confidence,
        reason,
        predictedGoLive: predictedGoLive.toISOString(),
        daysVariance,
      },
    };
  }

  async getOnboardingBlockerSummary(tenantId: string) {
    const blockedItems = await this.prisma.onboardingItem.findMany({
      where: { tenant_id: tenantId, status: 'blocked' },
      orderBy: { due_date: 'asc' },
      select: { title: true, due_date: true },
    });

    if (!blockedItems.length) {
      return {
        data: {
          onboardingId: tenantId,
          summary: 'No blockers detected — onboarding is clear to proceed.',
          blockerCount: 0,
          mostUrgent: undefined,
        },
      };
    }

    const mostUrgent = blockedItems[0].title;
    const summary =
      blockedItems.length === 1
        ? `1 blocker: "${mostUrgent}". Needs immediate resolution.`
        : `${blockedItems.length} blockers active. Most urgent: "${mostUrgent}".`;

    return {
      data: {
        onboardingId: tenantId,
        summary,
        blockerCount: blockedItems.length,
        mostUrgent,
      },
    };
  }

  async getOnboardingNextAction(tenantId: string) {
    const pendingItems = await this.prisma.onboardingItem.findMany({
      where: { tenant_id: tenantId, status: { in: ['pending', 'in_progress'] } },
      orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
      take: 1,
      select: { id: true, title: true, due_date: true, assignee_id: true },
    });

    if (!pendingItems.length) {
      return {
        data: {
          onboardingId: tenantId,
          action: 'All tasks are complete — schedule go-live confirmation call.',
          priority: 'LOW' as const,
          ownedBy: 'DELIVERY' as const,
          draftMessage: undefined,
        },
      };
    }

    const next = pendingItems[0];
    const now = new Date();
    const daysUntilDue = next.due_date
      ? Math.floor((new Date(next.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
    const priority: 'HIGH' | 'MEDIUM' | 'LOW' =
      isOverdue ? 'HIGH' : daysUntilDue !== null && daysUntilDue <= 3 ? 'HIGH' : 'MEDIUM';

    const draftMessage = isOverdue
      ? `Hi team,\n\nThe task "${next.title}" is overdue. Please provide an update on the status and revised completion date.\n\nThanks,\n3SC Team`
      : `Hi team,\n\nAs a reminder, the task "${next.title}" is due ${daysUntilDue !== null ? `in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}` : 'soon'}. Please ensure it is completed on time.\n\nThanks,\n3SC Team`;

    return {
      data: {
        onboardingId: tenantId,
        action: `Complete: ${next.title}${isOverdue ? ' (overdue)' : daysUntilDue !== null ? ` (due in ${daysUntilDue}d)` : ''}`,
        priority,
        ownedBy: 'DELIVERY' as const,
        draftMessage,
      },
    };
  }

  // ── Roadmap AI ────────────────────────────────────────────────────────────

  async getRoadmapSummary() {
    const features = await this.prisma.roadmapFeature.findMany({
      where: { status: { notIn: ['RELEASED', 'CANCELLED'] as any } },
      orderBy: { votes: 'desc' },
      take: 10,
      select: { id: true, title: true, votes: true, status: true },
    });

    const topIds = features.slice(0, 3).map((f) => f.id);
    const topTitles = features.slice(0, 3).map((f) => f.title);

    const reasoning =
      features.length === 0
        ? 'No active roadmap features found.'
        : `Top ${topTitles.length} most-voted feature${topTitles.length !== 1 ? 's' : ''}: ${topTitles.join(', ')}.`;

    return {
      data: {
        headline: features.length > 0 ? `${features.length} features in the pipeline` : 'Roadmap is empty',
        topRelevantFeatureIds: topIds,
        reasoning,
      },
    };
  }

  async classifyFeatureRequest(dto: { title?: string; description?: string; text?: string }) {
    const text = dto.text ?? dto.description ?? dto.title ?? '';
    const result = await this.aiService.classifyTicket(text.substring(0, 80), text);
    return { data: { category: result.category, confidence: result.categoryConfidence } };
  }

  // ── User / Agent AI ───────────────────────────────────────────────────────

  /**
   * Cosine similarity between two vectors.
   * Returns 0 when either vector is empty (no embedding available).
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Weighted composite score for an agent candidate.
   *   skill        40% — semantic similarity of agent skills to ticket (or keyword fallback)
   *   availability 20% — free capacity from workload
   *   ai           20% — confidence score returned by the LLM
   *   history      20% — past resolution success rate (resolved tickets / total assigned)
   */
  private computeAgentScore({
    skillScore,
    availabilityScore,
    aiConfidence,
    historyScore,
  }: {
    skillScore: number;
    availabilityScore: number;
    aiConfidence: number;
    historyScore: number;
  }): number {
    return (
      skillScore * 0.4 +
      availabilityScore * 0.2 +
      aiConfidence * 0.2 +
      historyScore * 0.2
    );
  }

  async getAssignSuggestions(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return { data: [] };

    const agents = await this.prisma.user.findMany({
      where: { tenant_id: ticket.tenant_id, role: { in: ['AGENT', 'LEAD'] as any } },
      include: {
        user_skills: { include: { skill: true } },
        workloads: true,
      },
    });

    if (agents.length === 0) return { data: [] };

    // ── Embeddings for semantic skill matching ────────────────────────────────
    const ticketText = `${ticket.title} ${ticket.description ?? ''}`;
    const [ticketEmbedding, aiResult] = await Promise.all([
      this.aiService.generateEmbedding(ticketText),
      this.aiService.suggestRoute(
        ticket.title,
        ticket.description ?? '',
        agents.map((a) => ({
          id: a.id,
          name: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email,
          skills: a.user_skills.map((us) => us.skill.name),
        })),
      ),
    ]);

    // Build a lookup from agent_id → AI ranking entry
    const aiRankMap = new Map(
      (aiResult.rankings ?? []).map((r) => [r.agent_id, r]),
    );

    // ── History: resolved / total assigned tickets per agent ─────────────────
    const resolvedCounts = await this.prisma.ticket.groupBy({
      by: ['assignee_id'],
      where: {
        tenant_id: ticket.tenant_id,
        assignee_id: { in: agents.map((a) => a.id) },
        status: { in: ['RESOLVED', 'CLOSED'] as any },
      },
      _count: { id: true },
    });
    const totalCounts = await this.prisma.ticket.groupBy({
      by: ['assignee_id'],
      where: {
        tenant_id: ticket.tenant_id,
        assignee_id: { in: agents.map((a) => a.id) },
      },
      _count: { id: true },
    });
    const resolvedMap = new Map(resolvedCounts.map((r) => [r.assignee_id, r._count.id]));
    const totalMap = new Map(totalCounts.map((r) => [r.assignee_id, r._count.id]));

    // ── Score every agent ─────────────────────────────────────────────────────
    const ticketTokens = ticketText.toLowerCase().split(/\W+/).filter(Boolean);

    const scored = await Promise.all(
      agents.map(async (a) => {
        // Skill score: average cosine similarity across agent skills, fallback to keyword overlap
        let skillScore = 0;
        if (ticketEmbedding.length > 0 && a.user_skills.length > 0) {
          const sims = await Promise.all(
            a.user_skills.map(async (us) => {
              const skillEmb = await this.aiService.generateEmbedding(us.skill.name);
              return this.cosineSimilarity(ticketEmbedding, skillEmb);
            }),
          );
          skillScore = (sims.reduce((s, v) => s + v, 0) / sims.length) * 100;
        } else {
          // Keyword fallback when embeddings unavailable
          const matched = a.user_skills.filter((us) =>
            ticketTokens.some((tok) => us.skill.name.toLowerCase().includes(tok)),
          );
          skillScore = Math.min(100, matched.length * 25);
        }

        // Availability score: free capacity as % of max
        const workload = (a.workloads as any[])?.[0];
        let availabilityScore = 80;
        if (workload) {
          const capacity = workload.max_capacity > 0 ? workload.max_capacity : 10;
          availabilityScore = Math.max(0, Math.round(((capacity - workload.active_tickets) / capacity) * 100));
        }

        // AI confidence (0-100); default 50 when AI unavailable
        const aiEntry = aiRankMap.get(a.id);
        const aiConfidence = aiEntry?.confidence ?? 50;

        // History score: % of assigned tickets resolved
        const resolved = resolvedMap.get(a.id) ?? 0;
        const total = totalMap.get(a.id) ?? 0;
        const historyScore = total > 0 ? Math.round((resolved / total) * 100) : 60;

        const overallScore = Math.round(
          this.computeAgentScore({ skillScore, availabilityScore, aiConfidence, historyScore }),
        );

        // Semantic matched skills for display
        const matchedSkills = a.user_skills
          .filter((us) => ticketTokens.some((tok) => us.skill.name.toLowerCase().includes(tok)))
          .map((us) => us.skill.name);

        return {
          agentId: a.id,
          agentName: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email,
          agentEmail: a.email,
          skills: a.user_skills.map((us) => ({
            skillId: us.skill_id,
            skillName: us.skill.name,
            proficiency: (us as any).proficiency ?? 1,
          })),
          overallScore,
          factors: {
            skillScore: Math.round(skillScore),
            availabilityScore,
            aiConfidence,
            historyScore,
          },
          matchedSkills,
          reasoning: aiEntry?.reasoning ?? (matchedSkills.length > 0
            ? `Matched skills: ${matchedSkills.join(', ')}`
            : 'Available agent with general capability'),
        };
      }),
    );

    // Sort by overallScore descending, return top 3
    const suggestions = scored.sort((a, b) => b.overallScore - a.overallScore).slice(0, 3);

    return { data: suggestions };
  }

  async getSkillGaps() {
    const openTickets = await this.prisma.ticket.findMany({
      where: { status: { notIn: ['RESOLVED', 'CLOSED'] } },
      select: { category: true, id: true, priority: true },
    });

    const skills = await this.prisma.skill.findMany({
      include: { user_skills: true },
    });

    // Build category → ticket list map with priority weighting
    const priorityWeight: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const categoryTickets = new Map<string, { ids: string[]; weight: number }>();
    for (const t of openTickets) {
      const cat = (t.category as string) || 'GENERAL';
      if (!categoryTickets.has(cat)) categoryTickets.set(cat, { ids: [], weight: 0 });
      const entry = categoryTickets.get(cat)!;
      entry.ids.push(t.id);
      entry.weight += priorityWeight[(t.priority as string) ?? 'MEDIUM'] ?? 2;
    }

    // Category-to-skill keyword mapping (expands beyond single first-word)
    const categoryKeywords: Record<string, string[]> = {
      INCIDENT: ['incident', 'outage', 'downtime', 'monitoring'],
      BUG: ['bug', 'debug', 'fix', 'qa', 'testing'],
      BILLING: ['billing', 'payment', 'invoice', 'finance', 'accounting'],
      FEATURE_REQUEST: ['feature', 'product', 'design', 'ux', 'development'],
      SUPPORT: ['support', 'customer', 'helpdesk', 'communication'],
      QUESTION: ['documentation', 'training', 'knowledge'],
      TASK: ['project', 'management', 'coordination'],
    };

    const gaps = skills
      .filter((s) => s.user_skills.length < 2)
      .map((s) => {
        const skillTokens = s.name.toLowerCase().split(/\W+/);
        let bestCategory: string | undefined;
        let bestWeight = 0;

        for (const [cat, entry] of categoryTickets.entries()) {
          const keywords = categoryKeywords[cat] ?? [cat.toLowerCase()];
          const matches = skillTokens.some((tok) => keywords.some((kw) => kw.includes(tok) || tok.includes(kw)));
          if (matches && entry.weight > bestWeight) {
            bestWeight = entry.weight;
            bestCategory = cat;
          }
        }

        const ticketEntry = bestCategory ? categoryTickets.get(bestCategory) : undefined;
        const openCount = ticketEntry?.ids.length ?? 0;
        // gap severity combines open tickets and their priority weight
        const gapScore = ticketEntry ? Math.round(ticketEntry.weight / (s.user_skills.length || 1)) : 0;

        return {
          skillId: s.id,
          skillName: s.name,
          openTickets: openCount,
          agentsWithSkill: s.user_skills.length,
          gapScore,
          sampleTicketIds: ticketEntry?.ids.slice(0, 3) ?? [],
          suggestedAction:
            s.user_skills.length === 0
              ? `No agents have "${s.name}" — consider hiring or training`
              : `Only 1 agent has "${s.name}" — single point of failure`,
        };
      })
      .filter((g) => g.openTickets > 0 || g.agentsWithSkill === 0)
      .sort((a, b) => b.gapScore - a.gapScore);

    return { data: gaps };
  }

  // ── Similar Tickets ───────────────────────────────────────────────────────

  async getSimilarTickets(title: string, description: string, tenantId: string) {
    const words = `${title} ${description}`.split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
    if (!words.length) return { data: [] };

    const tickets = await this.prisma.ticket.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ['RESOLVED', 'CLOSED'] },
        OR: words.map((w) => ({ title: { contains: w, mode: 'insensitive' as const } })),
      },
      orderBy: { updated_at: 'desc' },
      take: 3,
      select: { id: true, ticket_number: true, title: true, status: true, resolved_at: true },
    });

    return {
      data: tickets.map((t) => ({
        ticketId: t.id,
        ticketNumber: t.ticket_number,
        title: t.title,
        status: t.status,
      })),
    };
  }

  async suggestSkills(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { user_skills: { include: { skill: true } } },
    });
    if (!user) return { data: { suggestedSkills: [], reasoning: 'User not found' } };

    const currentSkillNames = user.user_skills.map((us) => us.skill.name);
    const currentSkillIds = user.user_skills.map((us) => us.skill_id);

    // Tickets this agent has resolved — drives personalised skill suggestions
    const resolvedTickets = await this.prisma.ticket.findMany({
      where: {
        assignee_id: userId,
        status: { in: ['RESOLVED', 'CLOSED'] as any },
      },
      select: { category: true, tags: true },
      take: 50,
    });

    // Skills used by top performers (agents with highest resolution rates) on the same tenant
    const topAgentIds = await this.prisma.ticket
      .groupBy({
        by: ['assignee_id'],
        where: {
          tenant_id: user.tenant_id,
          status: { in: ['RESOLVED', 'CLOSED'] as any },
          assignee_id: { not: userId },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      })
      .then((rows) => rows.map((r) => r.assignee_id).filter(Boolean) as string[]);

    const topPerformerSkills = topAgentIds.length > 0
      ? await this.prisma.userSkill.findMany({
          where: {
            user_id: { in: topAgentIds },
            skill_id: { notIn: currentSkillIds },
          },
          include: { skill: true },
          distinct: ['skill_id'],
          take: 10,
        })
      : [];

    // Categories the agent frequently handles — look for coverage gaps in those
    const handledCategories = [...new Set(resolvedTickets.map((t) => t.category as string).filter(Boolean))];

    const gapSkills = await this.prisma.skill.findMany({
      where: {
        id: { notIn: currentSkillIds },
        ...(topPerformerSkills.length > 0
          ? { id: { notIn: [...currentSkillIds, ...topPerformerSkills.map((s) => s.skill_id)] } }
          : {}),
      },
      include: { user_skills: true },
      take: 10,
    });

    // Merge: top-performer skills first, then coverage gap skills; deduplicate
    const seen = new Set<string>();
    const candidates = [...topPerformerSkills.map((us) => us.skill), ...gapSkills]
      .filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      })
      .slice(0, 5);

    let reasoning: string;
    if (candidates.length === 0) {
      reasoning = 'This agent already has comprehensive skill coverage.';
    } else if (topPerformerSkills.length > 0 && handledCategories.length > 0) {
      reasoning = `Based on skills used by top-performing agents and your history in ${handledCategories.slice(0, 2).join(', ')} tickets, these skills would expand your resolution capability.`;
    } else {
      reasoning = 'Based on team coverage gaps, these skills would increase your ticket resolution range.';
    }

    return {
      data: {
        suggestedSkills: candidates.map((s) => ({
          id: s.id,
          name: s.name,
          category: (s as any).category ?? null,
          description: (s as any).description ?? null,
        })),
        reasoning,
      },
    };
  }
}
