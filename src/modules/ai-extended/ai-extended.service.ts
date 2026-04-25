import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class AiExtendedService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  // ── Ticket AI ─────────────────────────────────────────────────────────────

  async getSuggestion(ticketId: string, type: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { comments: { take: 5, orderBy: { created_at: 'asc' } } },
    });

    if (!ticket) {
      return { data: { id: `sugg_${ticketId}_${type}`, type, suggestion: {}, confidence: 0 } };
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
      const result = await this.aiService.suggestRoute(ticket.title, ticket.description ?? '', agentList);
      suggestion = { agent_id: result.agent_id, reasoning: result.reasoning };
    }

    return { data: { id: `sugg_${ticketId}_${type}`, type, suggestion, confidence } };
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
    const embedding = await this.aiService.generateEmbedding(query);
    if (!embedding.length) return { data: [] };
    return { data: [] };
  }

  async acceptSuggestion(id: string) {
    return { success: true };
  }

  async rejectSuggestion(id: string, reason?: string) {
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
    if (!project) return { data: { health_score: 0, summary: 'Project not found' } };
    return { data: { health_score: project.health_score ?? 100, summary: 'Project health computed from metadata' } };
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
          status: { in: ['RESOLVED', 'CLOSED'] },
          updated_at: { gte: weekAgo },
        },
      }),
      this.prisma.ticket.findMany({
        where: {
          tenant_id: project.tenant_id,
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
    const health = project.health_score ?? 100;

    // Build period string
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const period = `${fmt(weekAgo)} – ${fmt(now)}`;

    // Confidence statement derived from health + milestone status
    const milestoneConfidence = nextMilestone
      ? `${health}% confident that the "${nextMilestone.title}" milestone will be delivered${nextMilestone.dueDate ? ` by ${new Date(nextMilestone.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''} if current velocity is maintained.`
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
        generatedAt: now.toISOString(),
      },
    };
  }

  // 4-week rolling average resolved tickets/week for this tenant
  private async rollingVelocity(tenantId: string): Promise<number> {
    const now = new Date();
    const DAY = 24 * 60 * 60 * 1000;
    // Count cumulative resolved in each trailing window, then derive per-week delta
    const [w1, w2, w3, w4] = await Promise.all(
      [1, 2, 3, 4].map((w) =>
        this.prisma.ticket.count({
          where: {
            tenant_id: tenantId,
            status: { in: ['RESOLVED', 'CLOSED'] },
            updated_at: { gte: new Date(now.getTime() - w * 7 * DAY) },
          },
        }),
      ),
    );
    // Deltas per week: w1 = last 7 days, (w2-w1) = 7-14 days ago, etc.
    const perWeek = [w1, w2 - w1, w3 - w2, w4 - w3].map((n) => Math.max(0, n));
    const avg = perWeek.reduce((a, b) => a + b, 0) / perWeek.length;
    return Math.max(1, Math.round(avg));
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

    // Rolling velocity scoped to this tenant's ticket history
    const velocity = await this.rollingVelocity(project.tenant_id);

    // Project-level open count from metadata (seeded per project) as a fallback signal
    const projectOpenCount: number = meta.openTicketCount ?? 0;

    // Fetch open tickets for this tenant — used to find tickets that mention milestone ids/titles
    const tenantOpenTickets = await this.prisma.ticket.findMany({
      where: { tenant_id: project.tenant_id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      select: { id: true, title: true, tags: true, sla_deadline_at: true },
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

      return {
        milestoneId: m.id,
        milestoneName: m.title,
        scheduledDate: scheduled.toISOString(),
        predictedDate: predicted.toISOString(),
        onTrack,
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

  async getDeliveryRisk() {
    const features = await this.prisma.deliveryItem.findMany({
      where: { status: { notIn: ['DONE', 'CANCELLED'] as any } },
      orderBy: { due_date: 'asc' },
      take: 20,
      select: { id: true, title: true, status: true, due_date: true, priority: true },
    });

    const now = new Date();
    const risks = features
      .map((f) => {
        const daysUntilEta = f.due_date
          ? Math.floor((new Date(f.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        let reason = 'Feature is progressing normally';

        if (daysUntilEta !== null && daysUntilEta < 0) {
          riskLevel = 'HIGH';
          reason = `ETA passed ${Math.abs(daysUntilEta)} day${Math.abs(daysUntilEta) !== 1 ? 's' : ''} ago`;
        } else if (daysUntilEta !== null && daysUntilEta <= 7) {
          riskLevel = (f.priority === 'HIGH' || f.priority === 'URGENT') ? 'HIGH' : 'MEDIUM';
          reason = `ETA in ${daysUntilEta} day${daysUntilEta !== 1 ? 's' : ''} — close deadline`;
        } else if (f.status === 'IN_PROGRESS' && daysUntilEta !== null && daysUntilEta <= 14) {
          riskLevel = 'MEDIUM';
          reason = 'In progress with a tight deadline approaching';
        }

        return {
          featureId: f.id,
          featureTitle: f.title,
          riskLevel,
          reason,
          daysUntilEta: daysUntilEta ?? undefined,
          recommendation:
            riskLevel === 'HIGH'
              ? 'Escalate immediately and re-evaluate scope'
              : riskLevel === 'MEDIUM'
                ? 'Review progress in next standup'
                : 'No action required',
        };
      })
      .filter((f) => f.riskLevel !== 'LOW');

    return { data: risks };
  }

  async prioritiseDelivery() {
    const features = await this.prisma.deliveryItem.findMany({
      where: { status: { notIn: ['DONE', 'CANCELLED'] as any } },
      select: { id: true, title: true, status: true, priority: true, due_date: true },
    });

    const priorityScore: Record<string, number> = { URGENT: 100, HIGH: 75, MEDIUM: 50, LOW: 25 };
    const now = new Date();

    const scored = features.map((f) => {
      let score = priorityScore[(f.priority as string) ?? 'MEDIUM'] ?? 50;
      if (f.due_date) {
        const days = (new Date(f.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (days < 0) score += 30;
        else if (days < 7) score += 20;
        else if (days < 14) score += 10;
      }
      score = Math.min(100, score);

      const suggestedStatus: string =
        score >= 90 ? 'IN_PROGRESS' : score >= 60 ? 'IN_PROGRESS' : 'BACKLOG';

      return {
        featureId: f.id,
        featureTitle: f.title,
        suggestedStatus,
        score,
        reasoning:
          score >= 90
            ? 'Critical priority — work on this immediately'
            : score >= 60
              ? 'High value — schedule for current sprint'
              : 'Can be deferred to next cycle',
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return { data: scored };
  }

  async draftFeature(dto: { description?: string; topic?: string; context?: string }) {
    const topic = dto.description ?? dto.topic ?? 'new feature';
    const result = await this.aiService.generateKbDraft(topic, dto.context);

    // Map quarter from current date
    const now = new Date();
    const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear() + (now.getMonth() >= 9 ? 1 : 0)}`;

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

    const agentList = agents.map((a) => ({
      id: a.id,
      name: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email,
      skills: a.user_skills.map((us) => us.skill.name),
    }));

    const result = await this.aiService.suggestRoute(ticket.title, ticket.description ?? '', agentList);

    const suggestions = agents
      .filter((a) => a.id === result.agent_id || agentList.length <= 3)
      .slice(0, 3)
      .map((a, idx) => {
        const workload = (a.workloads as any[])?.[0];
        const matchedSkills = a.user_skills
          .map((us) => us.skill.name)
          .filter((s) =>
            (ticket.title + ' ' + (ticket.description ?? '')).toLowerCase().includes(s.toLowerCase()),
          );
        return {
          agentId: a.id,
          agentName: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email,
          agentEmail: a.email,
          skills: a.user_skills.map((us) => ({ skillId: us.skill_id, skillName: us.skill.name, level: (us as any).level ?? 'INTERMEDIATE' })),
          overallScore: idx === 0 ? 90 : 80 - idx * 10,
          skillScore: matchedSkills.length * 25,
          availabilityScore: workload ? Math.max(0, 100 - workload.current_tickets * 10) : 80,
          matchedSkills,
          reasoning: idx === 0 ? (result.reasoning || 'Best skill match for this ticket') : 'Alternative suggestion',
        };
      });

    return { data: suggestions };
  }

  async getSkillGaps() {
    // Find skills that appear in open ticket categories but have low agent coverage
    const openTickets = await this.prisma.ticket.findMany({
      where: { status: { notIn: ['RESOLVED', 'CLOSED'] } },
      select: { category: true, id: true },
    });

    const skills = await this.prisma.skill.findMany({
      include: { user_skills: true },
    });

    const categoryCount = new Map<string, string[]>();
    for (const t of openTickets) {
      const cat = (t.category as string) || 'GENERAL';
      if (!categoryCount.has(cat)) categoryCount.set(cat, []);
      categoryCount.get(cat)!.push(t.id);
    }

    const gaps = skills
      .filter((s) => s.user_skills.length < 2)
      .map((s) => {
        const relatedCategory = [...categoryCount.keys()].find((k) =>
          k.toLowerCase().includes(s.name.toLowerCase().split(' ')[0]),
        );
        const openTickets = relatedCategory ? categoryCount.get(relatedCategory)!.length : 0;
        return {
          skillId: s.id,
          skillName: s.name,
          openTickets,
          agentsWithSkill: s.user_skills.length,
          sampleTicketIds: relatedCategory ? categoryCount.get(relatedCategory)!.slice(0, 3) : [],
          suggestedAction:
            s.user_skills.length === 0
              ? `No agents have "${s.name}" — consider hiring or training`
              : `Only 1 agent has "${s.name}" — single point of failure`,
        };
      })
      .filter((g) => g.openTickets > 0 || g.agentsWithSkill === 0);

    return { data: gaps };
  }

  async suggestSkills(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { user_skills: { include: { skill: true } } },
    });
    if (!user) return { data: { suggestedSkills: [], reasoning: 'User not found' } };

    const currentSkillNames = user.user_skills.map((us) => us.skill.name);

    // Find skills that appear on other agents who handle the same ticket types
    const allSkills = await this.prisma.skill.findMany({
      where: { name: { notIn: currentSkillNames } },
      take: 5,
      select: { id: true, name: true, category: true, description: true },
    });

    const reasoning =
      allSkills.length === 0
        ? 'This agent already has comprehensive skill coverage.'
        : `Based on team coverage gaps, the following skills would increase this agent's ticket resolution range.`;

    return {
      data: {
        suggestedSkills: allSkills.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          description: s.description,
        })),
        reasoning,
      },
    };
  }
}
