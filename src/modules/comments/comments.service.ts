import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { eventBus } from '../../events/event-bus';
import { TICKET_EVENTS, EventActor, TicketEventTicket } from '../../events/ticket.events';

function toCommentActor(user: any): EventActor {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
  };
}

function toCommentEventTicket(ticket: any): TicketEventTicket {
  return {
    id: ticket.id,
    tenant_id: ticket.tenant_id,
    ticket_number: ticket.ticket_number,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority === 'URGENT' ? 'CRITICAL' : ticket.priority,
    category: ticket.category,
    requester_id: ticket.requester_id ?? null,
    assignee_id: ticket.assignee_id ?? null,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUuid(value: string, label = 'id'): void {
  if (!value || !UUID_RE.test(value)) {
    throw new BadRequestException(`Invalid ${label}: '${value}' is not a valid UUID`);
  }
}

const AUTHOR_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  avatar_url: true,
  role: true,
};

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async findByTicket(
    ticketId: string,
    tenantId: string,
    options: { includeInternal?: boolean } = {},
  ) {
    assertUuid(ticketId, 'ticket id');
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenant_id: tenantId },
      select: { id: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const where: any = { ticket_id: ticketId, tenant_id: tenantId, parent_id: null };
    if (!options.includeInternal) where.is_internal = false;

    const comments = await this.prisma.comment.findMany({
      where,
      orderBy: { created_at: 'asc' },
      include: {
        author: { select: AUTHOR_SELECT },
        replies: {
          where: options.includeInternal ? {} : { is_internal: false },
          orderBy: { created_at: 'asc' },
          include: { author: { select: AUTHOR_SELECT } },
        },
        attachments: {
          select: {
            id: true,
            filename: true,
            mime_type: true,
            size_bytes: true,
            storage_key: true,
            uploaded_by: true,
            created_at: true,
          },
        },
      },
    });

    return { data: comments.map((c) => this.formatComment(c)) };
  }

  async create(dto: {
    ticket_id?: string;
    ticketId?: string;
    tenant_id: string;
    author_id: string;
    body?: string;
    message?: string;
    content?: string;
    is_internal?: boolean;
    isInternal?: boolean;
    parent_id?: string;
    parentId?: string;
    mentioned_user_ids?: string[];
    attachment_ids?: string[];
  }) {
    // Normalize field names
    const ticketId = dto.ticket_id ?? dto.ticketId;
    const body = dto.body ?? dto.message ?? dto.content ?? '';
    const isInternal = dto.is_internal ?? dto.isInternal ?? false;
    const parentId = dto.parent_id ?? dto.parentId ?? null;
    const mentions = dto.mentioned_user_ids ?? [];
    const attachmentIds = dto.attachment_ids ?? [];

    if (!ticketId) {
      throw new BadRequestException('ticket_id or ticketId is required');
    }
    assertUuid(ticketId, 'ticket id');

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenant_id: dto.tenant_id },
      include: {
        requester: { select: { id: true, email: true, first_name: true, last_name: true } },
        assignee:  { select: { id: true, email: true, first_name: true, last_name: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: {
          id: parentId,
          ticket_id: ticketId,
          tenant_id: dto.tenant_id,
        },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException('Parent comment not found');
    }

    const comment = await this.prisma.comment.create({
      data: {
        tenant_id: dto.tenant_id,
        ticket_id: ticketId,
        author_id: dto.author_id,
        body,
        is_internal: isInternal,
        parent_id: parentId,
        mentions,
        ...(attachmentIds.length > 0
          ? {
              attachments: {
                connect: attachmentIds.map((id) => ({ id })),
              },
            }
          : {}),
      },
      include: {
        author: { select: AUTHOR_SELECT },
        attachments: true,
      },
    });

    // ── Emit domain event ─────────────────────────────────────────────────
    const author = comment.author ? toCommentActor(comment.author) : null;
    if (author) {
      eventBus.emit(TICKET_EVENTS.COMMENTED, {
        ticket: toCommentEventTicket(ticket),
        comment: {
          id: comment.id,
          body: comment.body,
          is_internal: comment.is_internal,
        },
        actor: author,
        requester: ticket.requester ? toCommentActor(ticket.requester) : null,
        assignee:  ticket.assignee  ? toCommentActor(ticket.assignee)  : null,
      });
    }

    return { data: this.formatComment(comment) };
  }

  async update(
    id: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
    body: string,
  ) {
    const comment = await this.prisma.comment.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    const isOwner = comment.author_id === actorId;
    const canEdit = isOwner || ['ADMIN', 'LEAD'].includes(actorRole);
    if (!canEdit) throw new ForbiddenException('You cannot edit this comment');

    const updated = await this.prisma.comment.update({
      where: { id },
      data: { body },
      include: { author: { select: AUTHOR_SELECT } },
    });

    return { data: this.formatComment(updated) };
  }

  async remove(
    id: string,
    tenantId: string,
    actorId: string,
    actorRole: string,
  ) {
    const comment = await this.prisma.comment.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    const isOwner = comment.author_id === actorId;
    const canDelete = isOwner || ['ADMIN', 'LEAD'].includes(actorRole);
    if (!canDelete) throw new ForbiddenException('You cannot delete this comment');

    await this.prisma.comment.delete({ where: { id } });
    return { success: true, message: 'Comment deleted successfully' };
  }

  private formatComment(comment: any) {
    return {
      id: comment.id,
      ticket_id: comment.ticket_id,
      tenant_id: comment.tenant_id,
      body: comment.body,
      is_internal: comment.is_internal,
      parent_id: comment.parent_id,
      mentions: comment.mentions ?? [],
      author: comment.author
        ? {
            id: comment.author.id,
            display_name:
              [comment.author.first_name, comment.author.last_name]
                .filter(Boolean)
                .join(' ') || comment.author.email,
            email: comment.author.email,
            avatar_url: comment.author.avatar_url,
            role: comment.author.role,
          }
        : null,
      attachments: comment.attachments ?? [],
      replies: comment.replies?.map((r: any) => this.formatComment(r)) ?? undefined,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
    };
  }
}
