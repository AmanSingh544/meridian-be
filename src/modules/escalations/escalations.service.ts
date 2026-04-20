import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class EscalationsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const data = await this.prisma.escalation.findMany({
      orderBy: { created_at: 'desc' },
      include: { ticket: true },
    });
    return { data };
  }

  async getAgents() {
    // Stub: return agents with current load
    return { data: [] };
  }

  async assign(id: string, dto: any) {
    const escalation = await this.prisma.escalation.findUnique({ where: { id } });
    if (!escalation) throw new NotFoundException('Escalation not found');
    return this.prisma.escalation.update({
      where: { id },
      data: { escalated_to: dto.agent_id },
    });
  }

  async resolve(id: string, dto: any) {
    const escalation = await this.prisma.escalation.findUnique({ where: { id } });
    if (!escalation) throw new NotFoundException('Escalation not found');
    return this.prisma.escalation.update({
      where: { id },
      data: { status: 'resolved', resolved_at: new Date() },
    });
  }
}
