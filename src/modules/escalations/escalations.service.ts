import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class EscalationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, opts: { status?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 25);
    const where: any = { tenant_id: tenantId };
    if (opts.status) where.status = opts.status;

    const [data, total] = await Promise.all([
      this.prisma.escalation.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          ticket: { select: { id: true, ticket_number: true, title: true, status: true, priority: true } },
        },
      }),
      this.prisma.escalation.count({ where }),
    ]);

    return { data, page, page_size: limit, total, total_pages: Math.ceil(total / limit) };
  }

  async create(tenantId: string, dto: { ticket_id: string; reason: string; escalated_to?: string }) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: dto.ticket_id, tenant_id: tenantId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const escalation = await this.prisma.escalation.create({
      data: {
        tenant_id: tenantId,
        ticket_id: dto.ticket_id,
        reason: dto.reason,
        escalated_to: dto.escalated_to,
        status: 'open',
      },
    });
    return { data: escalation };
  }

  async assign(id: string, tenantId: string, agentId: string) {
    const escalation = await this.prisma.escalation.findFirst({ where: { id, tenant_id: tenantId } });
    if (!escalation) throw new NotFoundException('Escalation not found');

    const updated = await this.prisma.escalation.update({
      where: { id },
      data: { escalated_to: agentId },
    });
    return { data: updated };
  }

  async resolve(id: string, tenantId: string) {
    const escalation = await this.prisma.escalation.findFirst({ where: { id, tenant_id: tenantId } });
    if (!escalation) throw new NotFoundException('Escalation not found');

    const updated = await this.prisma.escalation.update({
      where: { id },
      data: { status: 'resolved', resolved_at: new Date() },
    });
    return { data: updated };
  }
}
