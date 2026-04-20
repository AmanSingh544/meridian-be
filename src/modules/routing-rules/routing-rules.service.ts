import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class RoutingRulesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const data = await this.prisma.routingRule.findMany({ orderBy: { priority: 'asc' } });
    return { data };
  }

  async create(dto: any) {
    return this.prisma.routingRule.create({ data: dto });
  }

  async update(id: string, dto: any) {
    const rule = await this.prisma.routingRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Routing rule not found');
    return this.prisma.routingRule.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.routingRule.delete({ where: { id } });
    return { message: 'Routing rule deleted' };
  }
}
