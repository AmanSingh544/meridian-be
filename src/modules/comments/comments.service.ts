import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async findByTicket(ticketId: string, tenantId: string) {
    // Verify ticket exists and belongs to tenant
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenant_id: tenantId },
      select: { id: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const comments = await this.prisma.comment.findMany({
      where: { ticket_id: ticketId, tenant_id: tenantId },
      orderBy: { created_at: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar_url: true,
            role: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
                avatar_url: true,
                role: true,
              },
            },
          },
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

    return { data: comments };
  }

  async create(dto: {
    ticket_id: string;
    tenant_id: string;
    author_id: string;
    body: string;
    is_internal?: boolean;
    parent_id?: string;
    mentions?: string[];
  }) {
    // Verify ticket exists and belongs to tenant
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: dto.ticket_id, tenant_id: dto.tenant_id },
      select: { id: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // If parent_id provided, verify it exists on same ticket
    if (dto.parent_id) {
      const parent = await this.prisma.comment.findFirst({
        where: {
          id: dto.parent_id,
          ticket_id: dto.ticket_id,
          tenant_id: dto.tenant_id,
        },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException('Parent comment not found');
    }

    const comment = await this.prisma.comment.create({
      data: {
        tenant_id: dto.tenant_id,
        ticket_id: dto.ticket_id,
        author_id: dto.author_id,
        body: dto.body,
        is_internal: dto.is_internal ?? false,
        parent_id: dto.parent_id ?? null,
        mentions: dto.mentions ?? [],
      },
      include: {
        author: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            avatar_url: true,
            role: true,
          },
        },
        attachments: true,
      },
    });

    return { data: comment };
  }
}
