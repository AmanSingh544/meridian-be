import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, filters: { status?: string; page: number; limit: number }) {
    const where: any = { tenant_id: tenantId };
    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { created_at: 'desc' },
        include: {
          requester: { select: { id: true, first_name: true, last_name: true, email: true, avatar_url: true } },
          assignee: { select: { id: true, first_name: true, last_name: true, email: true, avatar_url: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: filters.page,
        limit: filters.limit,
        total,
        total_pages: Math.ceil(total / filters.limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        requester: { select: { id: true, first_name: true, last_name: true, email: true, avatar_url: true } },
        assignee: { select: { id: true, first_name: true, last_name: true, email: true, avatar_url: true } },
        comments: {
          orderBy: { created_at: 'asc' },
          include: {
            author: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
          },
        },
        attachments: true,
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async create(dto: any) {
    return this.prisma.ticket.create({
      data: dto,
      include: {
        requester: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
    });
  }

  async update(id: string, tenantId: string, dto: any) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return this.prisma.ticket.update({
      where: { id },
      data: { ...dto, updated_at: new Date() },
    });
  }

  async transition(id: string, tenantId: string, newStatus: string, userId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Add state machine validation here if needed
    const updates: any = { status: newStatus };
    
    if (newStatus === 'resolved') updates.resolved_at = new Date();
    if (newStatus === 'closed') updates.closed_at = new Date();

    return this.prisma.ticket.update({
      where: { id },
      data: updates,
    });
  }

  async remove(id: string, tenantId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    await this.prisma.ticket.delete({ where: { id } });
    return { message: 'Ticket deleted successfully' };
  }
}
