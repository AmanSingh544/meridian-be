import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SlaService } from '../sla/sla.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiService } from '../ai/ai.service';
import { RoutingRulesService } from '../routing-rules/routing-rules.service';
import { eventBus } from '../../events/event-bus';
import { TICKET_EVENTS, EventActor, TicketEventTicket } from '../../events/ticket.events';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUuid(value: string, label = 'id'): void {
  if (!value || !UUID_RE.test(value)) {
    throw new BadRequestException(`Invalid ${label}: '${value}' is not a valid UUID`);
  }
}

const TICKET_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['ACKNOWLEDGED', 'IN_PROGRESS', 'CLOSED'],
  ACKNOWLEDGED: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'],
  PENDING: ['IN_PROGRESS', 'CLOSED'],
  ESCALATED: ['IN_PROGRESS', 'CLOSED'],
};

const VALID_SORT_FIELDS = new Set([
  'created_at',
  'updated_at',
  'priority',
  'status',
  'ticket_number',
]);

const USER_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  avatar_url: true,
  role: true,
};

// DB enum uses URGENT; the frontend/API surface uses CRITICAL as an alias
function apiPriorityToDb(priority: string): string {
  const p = priority.toUpperCase();
  return p === 'CRITICAL' ? 'URGENT' : p;
}
function dbPriorityToApi(priority: string): string {
  return priority === 'URGENT' ? 'CRITICAL' : priority;
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
    + '-' + Date.now();
}

function toActor(user: any): EventActor {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
  };
}

function toEventTicket(ticket: any): TicketEventTicket {
  return {
    id: ticket.id,
    tenant_id: ticket.tenant_id,
    ticket_number: ticket.ticket_number,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    requester_id: ticket.requester_id ?? null,
    assignee_id: ticket.assignee_id ?? null,
  };
}

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private slaService: SlaService,
    private systemSettingsService: SystemSettingsService,
    private notificationsService: NotificationsService,
    private aiService: AiService,
    private routingRulesService: RoutingRulesService,
  ) {}

  async findAll(
    tenantId: string,
    filters: {
      status?: string | string[];
      priority?: string | string[];
      category?: string;
      assignee_id?: string;
      assignedTo?: string;
      unassigned?: boolean | string;
      requester_id?: string;
      project_id?: string;
      search?: string;
      date_from?: string;
      date_to?: string;
      page?: number;
      limit?: number;
      page_size?: number;
      sort_by?: string;
      sortBy?: string;
      sort_order?: 'asc' | 'desc';
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? filters.page_size ?? 25));
    const rawSortBy = filters.sort_by ?? filters.sortBy ?? 'updated_at';
    const sortBy = VALID_SORT_FIELDS.has(rawSortBy) ? rawSortBy : 'updated_at';
    const rawSortOrder = filters.sort_order ?? filters.sortOrder;
    const sortOrder = rawSortOrder === 'asc' ? 'asc' : 'desc';

    const where: any = { tenant_id: tenantId };

    if (filters.status) {
      const statuses = (Array.isArray(filters.status)
        ? filters.status
        : filters.status.split(',').map((s: string) => s.trim())
      ).map((s) => s.toUpperCase());
      where.status = { in: statuses };
    }
    if (filters.priority) {
      const priorities = (Array.isArray(filters.priority)
        ? filters.priority
        : filters.priority.split(',').map((s: string) => s.trim())
      ).map((s) => apiPriorityToDb(s));
      where.priority = { in: priorities };
    }
    if (filters.category) where.category = filters.category;
    const assigneeId = filters.assignee_id ?? filters.assignedTo;
    if (assigneeId) where.assignee_id = assigneeId;
    const isUnassigned = filters.unassigned === true || filters.unassigned === 'true';
    if (isUnassigned) where.assignee_id = null;
    if (filters.requester_id) where.requester_id = filters.requester_id;
    if (filters.project_id) where.project_id = filters.project_id;
    if (filters.date_from || filters.date_to) {
      where.created_at = {};
      if (filters.date_from) where.created_at.gte = new Date(filters.date_from);
      if (filters.date_to) where.created_at.lte = new Date(filters.date_to);
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { ticket_number: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { tags: { has: filters.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          requester: { select: USER_SELECT },
          assignee: { select: USER_SELECT },
          _count: { select: { comments: true, attachments: true } },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data: data.map((t) => this.formatTicket(t)),
      page,
      page_size: limit,
      total,
      total_pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string) {
    assertUuid(id, 'ticket id');
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        requester: { select: USER_SELECT },
        assignee: { select: USER_SELECT },
        comments: {
          orderBy: { created_at: 'asc' },
          include: {
            author: { select: USER_SELECT },
          },
        },
        attachments: true,
        _count: { select: { comments: true } },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    return { data: this.formatTicket(ticket) };
  }

  async create(dto: {
    tenant_id: string;
    requester_id: string;
    title: string;
    description?: string;
    priority: string;
    category: string;
    tags?: string[];
    assignee_id?: string;
    attachment_ids?: string[];
    environment?: string;
    project_id?: string;
    metadata?: Record<string, any>;
  }) {
    const metadata = {
      ...(dto.metadata ?? {}),
      ...(dto.environment ? { environment: dto.environment } : {}),
    };

    const ticketNumber = await this.generateTicketNumber(dto.tenant_id);
    const ticket = await this.prisma.ticket.create({
      data: {
        tenant_id: dto.tenant_id,
        project_id: dto.project_id ?? null,
        ticket_number: ticketNumber,
        title: dto.title,
        description: dto.description,
        priority: apiPriorityToDb(dto.priority) as any,
        category: dto.category as any,
        tags: dto.tags ?? [],
        requester_id: dto.requester_id,
        assignee_id: dto.assignee_id,
        status: 'OPEN',
        metadata: Object.keys(metadata).length ? metadata : undefined,
      },
      include: {
        requester: { select: USER_SELECT },
        assignee: { select: USER_SELECT },
        _count: { select: { comments: true, attachments: true } },
      },
    });

    // Link pre-uploaded attachments to this ticket
    if (dto.attachment_ids?.length) {
      await this.prisma.attachment.updateMany({
        where: { id: { in: dto.attachment_ids }, tenant_id: dto.tenant_id },
        data: { ticket_id: ticket.id },
      });
    }

    // ── Auto-assign via routing rules (only when no explicit assignee given) ──
    if (!dto.assignee_id) {
      const routedAgentId = await this.routingRulesService.evaluate(dto.tenant_id, {
        priority: ticket.priority,
        category: ticket.category ?? null,
        tags: ticket.tags ?? [],
        title: ticket.title,
        description: ticket.description ?? null,
        organization_id: (ticket.metadata as any)?.organization_id ?? null,
      }).catch(() => null); // routing is best-effort — never fail ticket creation

      if (routedAgentId) {
        const updatedWithAssignee = await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: { assignee_id: routedAgentId },
          include: {
            requester: { select: USER_SELECT },
            assignee: { select: USER_SELECT },
            _count: { select: { comments: true, attachments: true } },
          },
        });
        // Merge assignee back so the rest of the create flow uses the updated record
        ticket.assignee_id = updatedWithAssignee.assignee_id;
        ticket.assignee = updatedWithAssignee.assignee;
      }
    }

    // ── Emit domain event ─────────────────────────────────────────────────
    const actor = toActor(ticket.requester);
    const assignee = ticket.assignee ? toActor(ticket.assignee) : null;
    eventBus.emit(TICKET_EVENTS.CREATED, {
      ticket: toEventTicket(ticket),
      actor,
      requester: actor,
      assignee,
    });
    if (assignee) {
      eventBus.emit(TICKET_EVENTS.ASSIGNED, {
        ticket: toEventTicket(ticket),
        actor,
        assignee,
        previousAssigneeId: null,
      });
    }

    // ── Auto-apply global SLA policy ──────────────────────────────────────
    const slaPolicy = await this.prisma.slaPolicy.findFirst({
      where: {
        tenant_id: dto.tenant_id,
        name: `global_${apiPriorityToDb(dto.priority)}`,
        priority: apiPriorityToDb(dto.priority) as any,
      },
    });
    if (slaPolicy) {
      const bh = (slaPolicy.business_hours as any) || {};
      const resolutionDeadline = this.slaService.computeDeadline(
        ticket.created_at,
        slaPolicy.resolution_minutes,
        bh,
      );
      const firstResponseDeadline = this.slaService.computeDeadline(
        ticket.created_at,
        slaPolicy.first_response_minutes,
        bh,
      );
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          sla_policy_id: slaPolicy.id,
          sla_deadline_at: resolutionDeadline,
          metadata: {
            ...(ticket.metadata as any),
            first_response_deadline: firstResponseDeadline.toISOString(),
          },
        },
      });
      ticket.sla_deadline_at = resolutionDeadline;
    }

    return { data: this.formatTicket(ticket) };
  }

  async update(
    id: string,
    tenantId: string,
    dto: {
      title?: string;
      description?: string;
      priority?: string;
      category?: string;
      tags?: string[];
      assignee_id?: string;
      assigned_to?: string;
    },
    actorId?: string,
  ) {
    assertUuid(id, 'ticket id');
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const assigneeId = dto.assignee_id ?? dto.assigned_to;

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.priority !== undefined) updateData.priority = apiPriorityToDb(dto.priority);
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (assigneeId !== undefined) updateData.assignee_id = assigneeId;
    if ((dto as any).project_id !== undefined) updateData.project_id = (dto as any).project_id ?? null;

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        requester: { select: USER_SELECT },
        assignee: { select: USER_SELECT },
        _count: { select: { comments: true, attachments: true } },
      },
    });

    // ── Emit domain events ────────────────────────────────────────────────
    const previousAssigneeId = ticket.assignee_id ?? null;
    const newAssigneeId = updated.assignee_id ?? null;

    const actorUser = actorId
      ? await this.prisma.user.findUnique({
          where: { id: actorId },
          select: { id: true, email: true, first_name: true, last_name: true },
        })
      : null;
    const resolvedActor = actorUser
      ? toActor(actorUser)
      : updated.requester
        ? toActor(updated.requester)
        : { id: actorId ?? '', email: '', first_name: '', last_name: '' };

    eventBus.emit(TICKET_EVENTS.UPDATED, {
      ticket: toEventTicket(updated),
      actor: resolvedActor,
      assignee: updated.assignee ? toActor(updated.assignee) : null,
      previousAssigneeId,
    });

    // Only fire ASSIGNED when the assignee actually changed to a new person
    if (
      newAssigneeId &&
      newAssigneeId !== previousAssigneeId &&
      updated.assignee
    ) {
      eventBus.emit(TICKET_EVENTS.ASSIGNED, {
        ticket: toEventTicket(updated),
        actor: resolvedActor,
        assignee: toActor(updated.assignee),
        previousAssigneeId,
      });
    }

    return { data: this.formatTicket(updated) };
  }

  async bulkUpdate(
    tenantId: string,
    dto: {
      ticket_ids: string[];
      updates?: {
        title?: string;
        description?: string;
        priority?: string;
        category?: string;
        tags?: string[];
        assignee_id?: string;
        assigned_to?: string;
        project_id?: string;
      };
    },
    actorId?: string,
  ) {
    if (!dto.ticket_ids?.length) {
      throw new BadRequestException('ticket_ids must contain at least one ID');
    }

    // Validate all IDs are valid UUIDs
    for (const id of dto.ticket_ids) {
      assertUuid(id, 'ticket id');
    }

    // Verify all tickets exist and belong to tenant
    const tickets = await this.prisma.ticket.findMany({
      where: {
        id: { in: dto.ticket_ids },
        tenant_id: tenantId,
      },
      select: { id: true, assignee_id: true },
    });

    if (tickets.length !== dto.ticket_ids.length) {
      const foundIds = new Set(tickets.map((t) => t.id));
      const missing = dto.ticket_ids.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Tickets not found: ${missing.join(', ')}`);
    }

    const assigneeId = dto.updates?.assignee_id ?? dto.updates?.assigned_to;

    const updateData: any = {};
    if (dto.updates?.title !== undefined) updateData.title = dto.updates.title;
    if (dto.updates?.description !== undefined) updateData.description = dto.updates.description;
    if (dto.updates?.priority !== undefined) updateData.priority = apiPriorityToDb(dto.updates.priority);
    if (dto.updates?.category !== undefined) updateData.category = dto.updates.category;
    if (dto.updates?.tags !== undefined) updateData.tags = dto.updates.tags;
    if (assigneeId !== undefined) updateData.assignee_id = assigneeId;
    if (dto.updates?.project_id !== undefined) updateData.project_id = dto.updates.project_id ?? null;

    // If only assignee change, we can use updateMany for the DB write,
    // then fetch and emit events individually.
    // For simplicity and correctness with events, do individual updates in a transaction.
    const updatedTickets = await this.prisma.$transaction(
      dto.ticket_ids.map((id) =>
        this.prisma.ticket.update({
          where: { id },
          data: updateData,
          include: {
            requester: { select: USER_SELECT },
            assignee: { select: USER_SELECT },
            _count: { select: { comments: true, attachments: true } },
          },
        }),
      ),
    );

    // Emit domain events for each ticket (fire-and-forget, don't block response)
    const actorUser = actorId
      ? await this.prisma.user.findUnique({
          where: { id: actorId },
          select: { id: true, email: true, first_name: true, last_name: true },
        })
      : null;
    const resolvedActor = actorUser
      ? toActor(actorUser)
      : { id: actorId ?? '', email: '', first_name: '', last_name: '' };

    for (let i = 0; i < updatedTickets.length; i++) {
      const updated = updatedTickets[i];
      const previousAssigneeId = tickets[i].assignee_id ?? null;
      const newAssigneeId = updated.assignee_id ?? null;

      eventBus.emit(TICKET_EVENTS.UPDATED, {
        ticket: toEventTicket(updated),
        actor: resolvedActor,
        assignee: updated.assignee ? toActor(updated.assignee) : null,
        previousAssigneeId,
      });

      if (newAssigneeId && newAssigneeId !== previousAssigneeId && updated.assignee) {
        eventBus.emit(TICKET_EVENTS.ASSIGNED, {
          ticket: toEventTicket(updated),
          actor: resolvedActor,
          assignee: toActor(updated.assignee),
          previousAssigneeId,
        });
      }
    }

    return {
      data: updatedTickets.map((t) => this.formatTicket(t)),
      updated: updatedTickets.length,
    };
  }

  async transition(
    id: string,
    tenantId: string,
    toStatus: string,
    _userId: string,
  ) {
    assertUuid(id, 'ticket id');
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const allowed = TICKET_TRANSITIONS[ticket.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new UnprocessableEntityException(
        `Cannot transition from ${ticket.status} to ${toStatus}. Valid transitions: ${allowed.join(', ')}`,
      );
    }

    const updateData: any = { status: toStatus };
    if (toStatus === 'RESOLVED') updateData.resolved_at = new Date();
    if (toStatus === 'CLOSED') updateData.closed_at = new Date();
    if (toStatus === 'OPEN') {
      updateData.resolved_at = null;
      updateData.closed_at = null;
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        requester: { select: USER_SELECT },
        assignee: { select: USER_SELECT },
        _count: { select: { comments: true, attachments: true } },
      },
    });

    // ── Emit domain event ─────────────────────────────────────────────────
    const transitionActor = await this.prisma.user.findUnique({
      where: { id: _userId },
      select: { id: true, email: true, first_name: true, last_name: true },
    });
    eventBus.emit(TICKET_EVENTS.STATUS_CHANGED, {
      ticket: toEventTicket(updated),
      actor: transitionActor
        ? toActor(transitionActor)
        : { id: _userId, email: '', first_name: '', last_name: '' },
      requester: updated.requester ? toActor(updated.requester) : null,
      assignee: updated.assignee ? toActor(updated.assignee) : null,
      previousStatus: ticket.status,
    });

    // ── Post-transition side-effects (fire-and-forget, never block response) ─
    this.runPostTransitionEffects(ticket, toStatus, tenantId).catch(() => {});

    return { data: this.formatTicket(updated) };
  }

  private async runPostTransitionEffects(
    ticket: any,
    toStatus: string,
    tenantId: string,
  ): Promise<void> {
    const settings = await this.systemSettingsService.getSettings(tenantId);

    // ── Notify requester on status change ──────────────────────────────────
    if (settings.data.notifications.clientStatusNotifications && ticket.requester_id) {
      await this.notificationsService.create({
        tenant_id: tenantId,
        user_id: ticket.requester_id,
        type: 'ticket_status_change',
        title: `Ticket ${ticket.ticket_number} updated`,
        body: `Status changed to ${toStatus}`,
        data: { ticket_id: ticket.id, status: toStatus },
      });
    }

    // ── Auto-generate KB draft on resolve ──────────────────────────────────
    if (toStatus === 'RESOLVED' && settings.data.aiFeatures.autoGenerateKBArticlesEnabled) {
      try {
        const draft = await this.aiService.generateKbDraft(
          ticket.title,
          ticket.description ?? '',
        );
        const draftTitle = draft.title || ticket.title;
        const draftContent = draft.content || `Auto-generated draft from ticket ${ticket.ticket_number}`;
        await this.prisma.kbArticle.create({
          data: {
            tenant_id: tenantId,
            title: draftTitle,
            slug: toSlug(draftTitle),
            excerpt: draftContent.split('\n').find((l: string) => l.trim()) ?? '',
            content: draftContent,
            tags: ticket.tags ?? [],
            related_article_ids: [],
            status: 'draft',
          },
        });
      } catch {
        // KB draft generation is best-effort — never fail the transition
      }
    }
  }

  async remove(id: string, tenantId: string) {
    assertUuid(id, 'ticket id');
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    await this.prisma.ticket.delete({ where: { id } });
    return { success: true, message: 'Ticket deleted successfully' };
  }

  private async generateTicketNumber(tenantId: string): Promise<string> {
    const rows = await this.prisma.$queryRaw<[{ last_number: number }]>`
      INSERT INTO ticket_counters (tenant_id, last_number)
      VALUES (${tenantId}::uuid, 1)
      ON CONFLICT (tenant_id)
      DO UPDATE SET last_number = ticket_counters.last_number + 1
      RETURNING last_number
    `;
    return `TKT-${String(rows[0].last_number).padStart(4, '0')}`;
  }

  private formatTicket(ticket: any) {
    const commentCount =
      ticket._count?.comments ?? ticket.comments?.length ?? 0;
    const attachmentCount =
      ticket._count?.attachments ?? ticket.attachments?.length ?? 0;

    return {
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: dbPriorityToApi(ticket.priority),
      category: ticket.category,
      tags: ticket.tags ?? [],
      requester_id: ticket.requester_id,
      assignee_id: ticket.assignee_id,
      tenant_id: ticket.tenant_id,
      comment_count: commentCount,
      attachment_count: attachmentCount,
      creator: ticket.requester
        ? {
            id: ticket.requester.id,
            display_name: [ticket.requester.first_name, ticket.requester.last_name]
              .filter(Boolean)
              .join(' ') || ticket.requester.email,
            email: ticket.requester.email,
            avatar_url: ticket.requester.avatar_url,
            role: ticket.requester.role,
          }
        : null,
      assignee: ticket.assignee
        ? {
            id: ticket.assignee.id,
            display_name: [ticket.assignee.first_name, ticket.assignee.last_name]
              .filter(Boolean)
              .join(' ') || ticket.assignee.email,
            email: ticket.assignee.email,
            avatar_url: ticket.assignee.avatar_url,
            role: ticket.assignee.role,
          }
        : null,
      comments: ticket.comments?.map((c: any) => ({
        id: c.id,
        body: c.body,
        is_internal: c.is_internal,
        parent_id: c.parent_id,
        author: c.author
          ? {
              id: c.author.id,
              display_name: [c.author.first_name, c.author.last_name]
                .filter(Boolean)
                .join(' ') || c.author.email,
              avatar_url: c.author.avatar_url,
            }
          : null,
        created_at: c.created_at,
        updated_at: c.updated_at,
      })),
      attachments: ticket.attachments ?? undefined,
      sla_deadline_at: ticket.sla_deadline_at,
      first_response_at: ticket.first_response_at,
      resolved_at: ticket.resolved_at,
      closed_at: ticket.closed_at,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      metadata: ticket.metadata ?? {},
      project_id: ticket.project_id ?? null,
      environment: (ticket.metadata as any)?.environment ?? null,
    };
  }
}
