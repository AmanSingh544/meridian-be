import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

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

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    filters: {
      status?: string | string[];
      priority?: string | string[];
      category?: string;
      assignee_id?: string;
      requester_id?: string;
      search?: string;
      date_from?: string;
      date_to?: string;
      page?: number;
      limit?: number;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
    },
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    const sortBy = VALID_SORT_FIELDS.has(filters.sort_by ?? '')
      ? filters.sort_by!
      : 'updated_at';
    const sortOrder = filters.sort_order === 'asc' ? 'asc' : 'desc';

    const where: any = { tenant_id: tenantId };

    if (filters.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : filters.status.split(',').map((s: string) => s.trim());
      where.status = { in: statuses };
    }
    if (filters.priority) {
      const priorities = Array.isArray(filters.priority)
        ? filters.priority
        : filters.priority.split(',').map((s: string) => s.trim());
      where.priority = { in: priorities };
    }
    if (filters.category) where.category = filters.category;
    if (filters.assignee_id) where.assignee_id = filters.assignee_id;
    if (filters.requester_id) where.requester_id = filters.requester_id;
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
      data: data.map(this.formatTicket),
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
      ...(dto.project_id ? { project_id: dto.project_id } : {}),
    };

    const ticketNumber = await this.generateTicketNumber(dto.tenant_id);
    const ticket = await this.prisma.ticket.create({
      data: {
        tenant_id: dto.tenant_id,
        ticket_number: ticketNumber,
        title: dto.title,
        description: dto.description,
        priority: dto.priority as any,
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
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (assigneeId !== undefined) updateData.assignee_id = assigneeId;

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        requester: { select: USER_SELECT },
        assignee: { select: USER_SELECT },
        _count: { select: { comments: true, attachments: true } },
      },
    });

    return { data: this.formatTicket(updated) };
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

    return { data: this.formatTicket(updated) };
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
      priority: ticket.priority,
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
      projectId: (ticket.metadata as any)?.project_id ?? null,
      environment: (ticket.metadata as any)?.environment ?? null,
    };
  }
}
