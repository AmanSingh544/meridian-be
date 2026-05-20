import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { CommentsService } from '../comments/comments.service';
import { AiService } from '../ai/ai.service';
import { AiExtendedService } from '../ai-extended/ai-extended.service';
import { ToolRegistry } from './tool-registry';
import { ToolHandlerContext, ToolResult, DraftAction } from './types/tool-definition';

/**
 * Executes AI Copilot tools by delegating to existing domain services.
 * Draft-only tools return a proposal instead of mutating data.
 */
@Injectable()
export class ToolExecutor {
  constructor(
    private prisma: PrismaService,
    private ticketsService: TicketsService,
    private commentsService: CommentsService,
    private aiService: AiService,
    private aiExtendedService: AiExtendedService,
    private registry: ToolRegistry,
  ) {}

  async execute(toolName: string, args: Record<string, unknown>, ctx: ToolHandlerContext): Promise<ToolResult> {
    const tool = this.registry.getTool(toolName);
    if (!tool) {
      return { type: 'error', data: null, message: `Tool '${toolName}' not found` };
    }

    // ── Permission check ───────────────────────────────────────────────────
    const hasPermission = tool.requiredPermissions.some(p => ctx.permissions.includes(p));
    if (!hasPermission) {
      return { type: 'error', data: null, message: `You do not have permission to use '${toolName}'` };
    }

    // ── Tenant isolation guard ─────────────────────────────────────────────
    const tenantId = ctx.tenantId;
    const normalizedArgs = this.snakeToCamel(args);

    try {
      // ── Draft-only tools return proposals ────────────────────────────────
      if (tool.isDraftOnly) {
        const draft = await this.buildDraft(toolName, normalizedArgs, ctx);
        return { type: 'draft', data: draft };
      }

      // ── Read tools execute directly ──────────────────────────────────────
      const result = await this.executeReadTool(toolName, normalizedArgs, tenantId, ctx);
      return { type: 'result', data: result };
    } catch (err: any) {
      return { type: 'error', data: null, message: err.message ?? 'Tool execution failed' };
    }
  }

  /**
   * Actually execute a draft action after user confirmation.
   */
  async executeDraft(toolName: string, payload: Record<string, unknown>, ctx: ToolHandlerContext): Promise<ToolResult> {
    const tool = this.registry.getTool(toolName);
    if (!tool || !tool.isDraftOnly) {
      return { type: 'error', data: null, message: `Draft tool '${toolName}' not found` };
    }
    const hasPermission = tool.requiredPermissions.some(p => ctx.permissions.includes(p));
    if (!hasPermission) {
      return { type: 'error', data: null, message: `Permission denied for '${toolName}'` };
    }

    payload = this.snakeToCamel(payload);

    try {
      switch (toolName) {
        case 'update_ticket_status': {
          const ticketId = String(payload.ticketId);
          const status = String(payload.status);
          const ticket = await this.resolveTicket(ticketId, ctx.tenantId);
          const result = await this.ticketsService.transition(ticket.id, ctx.tenantId, status.toUpperCase(), ctx.userId);
          return { type: 'result', data: result };
        }
        case 'assign_ticket': {
          const ticketId = String(payload.ticketId);
          const assigneeId = String(payload.assigneeId);
          const ticket = await this.resolveTicket(ticketId, ctx.tenantId);
          const result = await this.ticketsService.update(ticket.id, ctx.tenantId, { assignee_id: assigneeId });
          return { type: 'result', data: result };
        }
        case 'add_ticket_comment': {
          const ticketId = String(payload.ticketId);
          const content = String(payload.content);
          const isInternal = Boolean(payload.isInternal);
          const ticket = await this.resolveTicket(ticketId, ctx.tenantId);
          const result = await this.commentsService.create({
            ticket_id: ticket.id,
            tenant_id: ctx.tenantId,
            author_id: ctx.userId,
            content,
            is_internal: isInternal,
          });
          return { type: 'result', data: result };
        }
        case 'escalate_ticket': {
          const ticketId = String(payload.ticketId);
          const reason = String(payload.reason ?? '');
          const ticket = await this.resolveTicket(ticketId, ctx.tenantId);
          const escalation = await this.prisma.escalation.create({
            data: {
              tenant_id: ctx.tenantId,
              ticket_id: ticket.id,
              reason: reason || 'Escalated via AI Copilot',
              status: 'OPEN',
            },
          });
          // Also transition ticket to ESCALATED if possible
          try {
            await this.ticketsService.transition(ticket.id, ctx.tenantId, 'ESCALATED', ctx.userId);
          } catch { /* ignore transition errors */ }
          return { type: 'result', data: { escalation } };
        }
        case 'create_ticket': {
          const title = String(payload.title);
          const description = String(payload.description ?? '');
          const priority = String(payload.priority ?? 'MEDIUM');
          const category = String(payload.category ?? 'SUPPORT');
          const result = await this.ticketsService.create({
            tenant_id: ctx.tenantId,
            requester_id: ctx.userId,
            title,
            description,
            priority,
            category,
          });
          return { type: 'result', data: result };
        }
        case 'merge_tickets': {
          const primaryId = String(payload.ticketId ?? payload.primaryTicketId);
          const secondaryId = String(payload.secondaryTicketId);
          const primary = await this.resolveTicket(primaryId, ctx.tenantId);
          const secondary = await this.resolveTicket(secondaryId, ctx.tenantId);

          // Copy comments from secondary to primary
          const secondaryComments = await this.prisma.comment.findMany({
            where: { ticket_id: secondary.id, tenant_id: ctx.tenantId },
          });
          for (const comment of secondaryComments) {
            await this.prisma.comment.create({
              data: {
                tenant_id: ctx.tenantId,
                ticket_id: primary.id,
                author_id: comment.author_id,
                body: `[Merged from ${secondary.ticket_number}]\n${comment.body}`,
                is_internal: comment.is_internal,
              },
            });
          }

          // Close secondary and mark as merged
          await this.prisma.ticket.update({
            where: { id: secondary.id },
            data: {
              status: 'CLOSED',
              metadata: { ...(secondary.metadata as any), merged_into: primary.id },
            },
          });

          return { type: 'result', data: { primary: primary.ticket_number, secondary: secondary.ticket_number } };
        }
        case 'link_tickets': {
          const ticketId = String(payload.ticketId);
          const linkedId = String(payload.linkedTicketId);
          const ticket = await this.resolveTicket(ticketId, ctx.tenantId);
          const linked = await this.resolveTicket(linkedId, ctx.tenantId);

          const ticketMeta = (ticket.metadata as Record<string, unknown>) ?? {};
          const linkedMeta = (linked.metadata as Record<string, unknown>) ?? {};
          const ticketLinks = (ticketMeta.linked_ticket_ids as string[]) ?? [];
          const linkedLinks = (linkedMeta.linked_ticket_ids as string[]) ?? [];

          if (!ticketLinks.includes(linked.id)) ticketLinks.push(linked.id);
          if (!linkedLinks.includes(ticket.id)) linkedLinks.push(ticket.id);

          await this.prisma.ticket.update({
            where: { id: ticket.id },
            data: { metadata: { ...ticketMeta, linked_ticket_ids: ticketLinks } },
          });
          await this.prisma.ticket.update({
            where: { id: linked.id },
            data: { metadata: { ...linkedMeta, linked_ticket_ids: linkedLinks } },
          });

          return { type: 'result', data: { ticket: ticket.ticket_number, linked: linked.ticket_number } };
        }
        case 'generate_kb_draft': {
          const ticketId = String(payload.ticketId);
          const ticket = await this.resolveTicket(ticketId, ctx.tenantId);
          const draft = await this.aiExtendedService.generateKbDraft({
            topic: ticket.title,
            context: ticket.description ?? undefined,
          });

          const article = await this.prisma.kbArticle.create({
            data: {
              tenant_id: ctx.tenantId,
              category_id: null,
              title: draft.data.title,
              slug: `draft-${Date.now()}`,
              content: draft.data.content as string,
              status: 'draft',
              author_id: ctx.userId,
            },
          });

          return { type: 'result', data: { article_id: article.id, title: article.title } };
        }
        case 'schedule_reminder': {
          const text = String(payload.text);
          const when = String(payload.when);
          const remindAt = this.parseNaturalDate(when);

          const user = await this.prisma.user.findUnique({ where: { id: ctx.userId } });
          const prefs = (user?.preferences as Record<string, unknown>) ?? {};
          const reminders = (prefs.reminders as Array<{ id: string; text: string; remind_at: string; created_at: string }>) ?? [];
          const newReminder = {
            id: crypto.randomUUID(),
            text,
            remind_at: remindAt.toISOString(),
            created_at: new Date().toISOString(),
          };
          reminders.push(newReminder);

          await this.prisma.user.update({
            where: { id: ctx.userId },
            data: { preferences: { ...prefs, reminders } },
          });

          return { type: 'result', data: { reminder_id: newReminder.id, remind_at: newReminder.remind_at } };
        }
        default:
          return { type: 'error', data: null, message: `Unknown draft tool: ${toolName}` };
      }
    } catch (err: any) {
      return { type: 'error', data: null, message: err.message ?? 'Draft execution failed' };
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async executeReadTool(
    toolName: string,
    args: Record<string, unknown>,
    tenantId: string,
    ctx: ToolHandlerContext,
  ): Promise<unknown> {
    switch (toolName) {
      case 'get_ticket_detail': {
        const ticketId = String(args.ticketId);
        const ticket = await this.resolveTicket(ticketId, tenantId);
        return this.ticketsService.findOne(ticket.id, tenantId);
      }
      case 'search_tickets': {
        return this.ticketsService.findAll({ tenantId, role: ctx.role }, {
          search: args.query ? String(args.query) : undefined,
          status: args.status ? String(args.status) : undefined,
          priority: args.priority ? String(args.priority) : undefined,
          assignee_id: args.assigneeId ? String(args.assigneeId) : undefined,
          limit: typeof args.limit === 'number' ? args.limit : 10,
        });
      }
      case 'get_my_tickets': {
        return this.ticketsService.findAll({ tenantId, role: ctx.role }, {
          requester_id: ctx.userId,
          status: args.status ? String(args.status) : undefined,
          limit: typeof args.limit === 'number' ? args.limit : 10,
        });
      }
      case 'get_recent_tickets': {
        return this.ticketsService.findAll({ tenantId, role: ctx.role }, {
          sort_by: 'updated_at',
          sort_order: 'desc',
          limit: typeof args.limit === 'number' ? args.limit : 10,
          status: args.status ? String(args.status) : undefined,
        });
      }
      case 'get_ticket_summary': {
        const ticketId = String(args.ticketId);
        const ticket = await this.resolveTicket(ticketId, tenantId);
        const content = `${ticket.title}\n${ticket.description ?? ''}`;
        const summary = await this.aiService.summarizeTicket(content);
        return { data: { ticket_id: ticket.id, ticket_number: ticket.ticket_number, summary } };
      }
      case 'get_bug_summary': {
        const days = typeof args.days === 'number' ? args.days : 7;
        const limit = typeof args.limit === 'number' ? args.limit : 10;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const bugs = await this.prisma.ticket.findMany({
          where: {
            tenant_id: tenantId,
            category: 'BUG',
            created_at: { gte: since },
          },
          orderBy: { created_at: 'desc' },
          take: limit,
          include: {
            requester: { select: { id: true, first_name: true, last_name: true, email: true } },
            assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
          },
        });
        const open = bugs.filter(b => !['RESOLVED', 'CLOSED'].includes(b.status)).length;
        return {
          data: {
            total: bugs.length,
            open,
            resolved: bugs.length - open,
            bugs: bugs.map(b => ({
              id: b.id,
              ticket_number: b.ticket_number,
              title: b.title,
              status: b.status,
              priority: b.priority,
              assignee: b.assignee ? `${b.assignee.first_name ?? ''} ${b.assignee.last_name ?? ''}`.trim() || b.assignee.email : null,
            })),
          },
        };
      }
      case 'ask_kb': {
        return this.aiExtendedService.askKb({
          question: String(args.question),
          tenant_id: tenantId,
        });
      }
      case 'get_project_status': {
        const projectId = String(args.projectId);
        return this.aiExtendedService.getProjectHealth(projectId);
      }
      case 'get_sla_breaches': {
        const now = new Date();
        const limit = typeof args.limit === 'number' ? args.limit : 10;
        const where: any = {
          tenant_id: tenantId,
          sla_deadline_at: { not: null },
          status: { notIn: ['RESOLVED', 'CLOSED'] },
        };
        if (args.status) where.status = String(args.status);
        const tickets = await this.prisma.ticket.findMany({
          where,
          orderBy: { sla_deadline_at: 'asc' },
          take: limit,
          include: {
            requester: { select: { id: true, first_name: true, last_name: true, email: true } },
            assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
          },
        });
        const breached = tickets.filter(t => t.sla_deadline_at && t.sla_deadline_at < now);
        const atRisk = tickets.filter(t => t.sla_deadline_at && t.sla_deadline_at >= now);
        return {
          data: {
            breached_count: breached.length,
            at_risk_count: atRisk.length,
            breached: breached.map(t => this.formatTicketBrief(t)),
            at_risk: atRisk.map(t => this.formatTicketBrief(t)),
          },
        };
      }
      case 'get_agent_workload': {
        const agents = await this.prisma.user.findMany({
          where: { tenant_id: tenantId, role: { in: ['AGENT', 'LEAD', 'ADMIN'] as any } },
          include: { workloads: true },
        });
        const result = await Promise.all(
          agents.map(async (agent) => {
            const assigned = await this.prisma.ticket.count({
              where: { assignee_id: agent.id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
            });
            const wl = agent.workloads?.[0];
            return {
              id: agent.id,
              name: `${agent.first_name ?? ''} ${agent.last_name ?? ''}`.trim() || agent.email,
              assigned_tickets: assigned,
              max_capacity: wl?.max_capacity ?? 10,
              availability: wl?.availability ?? 'AVAILABLE',
              utilization_pct: wl ? Math.round((assigned / wl.max_capacity) * 100) : 0,
            };
          }),
        );
        return { data: result };
      }
      case 'get_client_overview': {
        const users = await this.prisma.user.findMany({
          where: { tenant_id: tenantId },
          select: { id: true, first_name: true, last_name: true, email: true, role: true, created_at: true },
        });
        const ticketCounts = await this.prisma.ticket.groupBy({
          by: ['status'],
          where: { tenant_id: tenantId },
          _count: { id: true },
        });
        const statusMap: Record<string, number> = {};
        for (const tc of ticketCounts) statusMap[tc.status] = tc._count.id;
        return {
          data: {
            members: users.map(u => ({
              id: u.id,
              name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email,
              role: u.role,
            })),
            ticket_summary: statusMap,
            total_members: users.length,
          },
        };
      }
      case 'get_releases': {
        const items = await this.prisma.deliveryItem.findMany({
          where: { tenant_id: tenantId, ...(args.status ? { status: String(args.status) as any } : {}) },
          orderBy: { created_at: 'desc' },
          take: typeof args.limit === 'number' ? args.limit : 25,
        });
        return { data: items };
      }
      case 'get_onboarding_summary': {
        const health = await this.aiExtendedService.getOnboardingHealth(tenantId);
        const blockers = await this.aiExtendedService.getOnboardingBlockerSummary(tenantId);
        return { data: { health, blockers } };
      }
      case 'get_digest': {
        return this.aiExtendedService.getDigest();
      }
      case 'get_similar_tickets': {
        return this.aiExtendedService.getSimilarTickets(
          String(args.title),
          String(args.description ?? ''),
          tenantId,
        );
      }
      case 'get_routing_suggestion': {
        const ticketId = String(args.ticketId);
        const ticket = await this.resolveTicket(ticketId, tenantId);
        return this.aiExtendedService.getAssignSuggestions(ticket.id);
      }
      case 'draft_reply': {
        const ticketId = String(args.ticketId);
        const ticket = await this.resolveTicket(ticketId, tenantId);
        const tone = String(args.tone ?? 'professional');
        const content = `${ticket.title}\n${ticket.description ?? ''}`;
        const result = await this.aiService.generateReply(content, [], tone);
        return { data: { reply: result.reply, ticket_id: ticket.id, ticket_number: ticket.ticket_number } };
      }
      case 'get_team_availability': {
        const agents = await this.prisma.user.findMany({
          where: { tenant_id: tenantId, role: { in: ['AGENT', 'LEAD', 'ADMIN'] as any } },
          include: { workloads: true },
        });
        const result = await Promise.all(
          agents.map(async (agent) => {
            const assigned = await this.prisma.ticket.count({
              where: { assignee_id: agent.id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
            });
            const wl = agent.workloads?.[0];
            return {
              id: agent.id,
              name: `${agent.first_name ?? ''} ${agent.last_name ?? ''}`.trim() || agent.email,
              assigned_tickets: assigned,
              max_capacity: wl?.max_capacity ?? 10,
              availability: wl?.availability ?? 'AVAILABLE',
              utilization_pct: wl ? Math.round((assigned / wl.max_capacity) * 100) : 0,
            };
          }),
        );
        return { data: result };
      }
      case 'get_analytics_summary': {
        const period = String(args.period ?? 'week');
        const now = new Date();
        let dateFilter: Date;
        if (period === 'today') {
          dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (period === 'month') {
          dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
        } else {
          dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        const [totalTickets, resolvedTickets, slaBreached, openByPriority, avgResolution] = await Promise.all([
          this.prisma.ticket.count({ where: { tenant_id: tenantId, created_at: { gte: dateFilter } } }),
          this.prisma.ticket.count({ where: { tenant_id: tenantId, status: { in: ['RESOLVED', 'CLOSED'] }, resolved_at: { gte: dateFilter } } }),
          this.prisma.ticket.count({ where: { tenant_id: tenantId, sla_deadline_at: { lt: now }, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
          this.prisma.ticket.groupBy({ by: ['priority'], where: { tenant_id: tenantId, status: { notIn: ['RESOLVED', 'CLOSED'] } }, _count: { id: true } }),
          this.prisma.ticket.findMany({
            where: { tenant_id: tenantId, status: { in: ['RESOLVED', 'CLOSED'] }, resolved_at: { not: null }, created_at: { gte: dateFilter } },
            select: { created_at: true, resolved_at: true },
            take: 100,
          }),
        ]);

        const avgResolutionHours = avgResolution.length > 0
          ? Math.round(avgResolution.reduce((sum, t) => sum + ((t.resolved_at!.getTime() - t.created_at.getTime()) / 3600000), 0) / avgResolution.length * 10) / 10
          : 0;

        const priorityMap: Record<string, number> = {};
        for (const p of openByPriority) priorityMap[p.priority] = p._count.id;

        return {
          data: {
            period,
            total_tickets: totalTickets,
            resolved_tickets: resolvedTickets,
            sla_breaches: slaBreached,
            average_resolution_hours: avgResolutionHours,
            open_by_priority: priorityMap,
          },
        };
      }
      default:
        throw new Error(`Unknown read tool: ${toolName}`);
    }
  }

  private async buildDraft(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolHandlerContext,
  ): Promise<DraftAction> {
    const ticketId = args.ticketId ? String(args.ticketId) : undefined;
    let ticket: any;
    if (ticketId) {
      ticket = await this.resolveTicket(ticketId, ctx.tenantId);
    }

    switch (toolName) {
      case 'update_ticket_status':
        return {
          type: 'draft',
          tool: toolName,
          displayTitle: `Update ticket status to ${args.status}`,
          displayDescription: ticket
            ? `Change ${ticket.ticket_number} "${ticket.title}" from ${ticket.status} to ${args.status}.`
            : `Change status to ${args.status}.`,
          payload: { ticketId: ticket?.id ?? ticketId, status: String(args.status), reason: String(args.reason ?? '') },
          confirmationLabel: 'Update Status',
          cancelLabel: 'Cancel',
        };
      case 'assign_ticket':
        return {
          type: 'draft',
          tool: toolName,
          displayTitle: 'Assign ticket',
          displayDescription: ticket
            ? `Assign ${ticket.ticket_number} "${ticket.title}" to agent.`
            : 'Assign ticket to agent.',
          payload: { ticketId: ticket?.id ?? ticketId, assigneeId: String(args.assigneeId), reason: String(args.reason ?? '') },
          confirmationLabel: 'Assign',
          cancelLabel: 'Cancel',
        };
      case 'add_ticket_comment':
        return {
          type: 'draft',
          tool: toolName,
          displayTitle: 'Add comment',
          displayDescription: ticket
            ? `Add comment to ${ticket.ticket_number} "${ticket.title}".`
            : 'Add comment to ticket.',
          payload: { ticketId: ticket?.id ?? ticketId, content: String(args.content), isInternal: Boolean(args.isInternal) },
          confirmationLabel: 'Post Comment',
          cancelLabel: 'Cancel',
        };
      case 'escalate_ticket':
        return {
          type: 'draft',
          tool: toolName,
          displayTitle: 'Escalate ticket',
          displayDescription: ticket
            ? `Escalate ${ticket.ticket_number} "${ticket.title}".`
            : 'Escalate ticket.',
          payload: { ticketId: ticket?.id ?? ticketId, reason: String(args.reason ?? '') },
          confirmationLabel: 'Escalate',
          cancelLabel: 'Cancel',
        };
      case 'create_ticket':
        return {
          type: 'draft',
          tool: toolName,
          displayTitle: 'Create ticket',
          displayDescription: `Create new ticket: "${args.title}"`,
          payload: {
            title: String(args.title),
            description: String(args.description ?? ''),
            priority: String(args.priority ?? 'MEDIUM'),
            category: String(args.category ?? 'SUPPORT'),
          },
          confirmationLabel: 'Create Ticket',
          cancelLabel: 'Cancel',
        };
      case 'merge_tickets': {
        const primary = args.primaryTicketId ? await this.resolveTicket(String(args.primaryTicketId), ctx.tenantId).catch(() => null) : null;
        const secondary = args.secondaryTicketId ? await this.resolveTicket(String(args.secondaryTicketId), ctx.tenantId).catch(() => null) : null;
        return {
          type: 'draft',
          tool: toolName,
          displayTitle: 'Merge tickets',
          displayDescription: `Merge ${secondary?.ticket_number ?? args.secondaryTicketId} into ${primary?.ticket_number ?? args.primaryTicketId}. Comments will be copied and the secondary ticket closed.`,
          payload: { primaryTicketId: primary?.id ?? args.primaryTicketId, secondaryTicketId: secondary?.id ?? args.secondaryTicketId },
          confirmationLabel: 'Merge',
          cancelLabel: 'Cancel',
        };
      }
      case 'link_tickets': {
        const t1 = args.ticketId ? await this.resolveTicket(String(args.ticketId), ctx.tenantId).catch(() => null) : null;
        const t2 = args.linkedTicketId ? await this.resolveTicket(String(args.linkedTicketId), ctx.tenantId).catch(() => null) : null;
        return {
          type: 'draft',
          tool: toolName,
          displayTitle: 'Link tickets',
          displayDescription: `Link ${t1?.ticket_number ?? args.ticketId} with ${t2?.ticket_number ?? args.linkedTicketId}.`,
          payload: { ticketId: t1?.id ?? args.ticketId, linkedTicketId: t2?.id ?? args.linkedTicketId },
          confirmationLabel: 'Link',
          cancelLabel: 'Cancel',
        };
      }
      case 'generate_kb_draft': {
        const sourceTicket = args.ticketId ? await this.resolveTicket(String(args.ticketId), ctx.tenantId).catch(() => null) : null;
        return {
          type: 'draft',
          tool: toolName,
          displayTitle: 'Generate KB draft',
          displayDescription: sourceTicket
            ? `Create a knowledge base article draft from ${sourceTicket.ticket_number} "${sourceTicket.title}".`
            : 'Generate KB article draft.',
          payload: { ticketId: sourceTicket?.id ?? args.ticketId },
          confirmationLabel: 'Generate Draft',
          cancelLabel: 'Cancel',
        };
      }
      case 'schedule_reminder':
        return {
          type: 'draft',
          tool: toolName,
          displayTitle: 'Schedule reminder',
          displayDescription: `Remind you: "${args.when}" — ${args.text}`,
          payload: { text: String(args.text), when: String(args.when) },
          confirmationLabel: 'Schedule',
          cancelLabel: 'Cancel',
        };
      default:
        throw new Error(`Unknown draft tool: ${toolName}`);
    }
  }

  private async resolveTicket(idOrNumber: string, tenantId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrNumber);
    const ticket = isUuid
      ? await this.prisma.ticket.findFirst({ where: { id: idOrNumber, tenant_id: tenantId } })
      : await this.prisma.ticket.findFirst({ where: { ticket_number: idOrNumber, tenant_id: tenantId } });
    if (!ticket) throw new NotFoundException(`Ticket not found: ${idOrNumber}`);
    return ticket;
  }

  private snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = value;
    }
    return result;
  }

  private parseNaturalDate(input: string): Date {
    const now = new Date();
    const lower = input.toLowerCase().trim();

    if (lower === 'tomorrow') {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
    if (lower === 'in 1 hour' || lower === 'in an hour') {
      return new Date(now.getTime() + 60 * 60 * 1000);
    }
    if (lower === 'in 2 hours') {
      return new Date(now.getTime() + 2 * 60 * 60 * 1000);
    }
    if (lower === 'in 30 minutes' || lower === 'in half an hour') {
      return new Date(now.getTime() + 30 * 60 * 1000);
    }

    const hourMatch = lower.match(/in (\d+) hours?/);
    if (hourMatch) {
      return new Date(now.getTime() + parseInt(hourMatch[1], 10) * 60 * 60 * 1000);
    }
    const dayMatch = lower.match(/in (\d+) days?/);
    if (dayMatch) {
      return new Date(now.getTime() + parseInt(dayMatch[1], 10) * 24 * 60 * 60 * 1000);
    }

    // Fallback to ISO parsing
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) return parsed;

    // Default: tomorrow
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  private formatTicketBrief(t: any) {
    return {
      id: t.id,
      ticket_number: t.ticket_number,
      title: t.title,
      status: t.status,
      priority: t.priority,
      sla_deadline_at: t.sla_deadline_at,
      assignee: t.assignee ? `${t.assignee.first_name ?? ''} ${t.assignee.last_name ?? ''}`.trim() || t.assignee.email : null,
    };
  }
}
