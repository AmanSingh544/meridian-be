import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class RoutingRulesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const data = await this.prisma.routingRule.findMany({
      where: { tenant_id: tenantId },
      orderBy: { priority: 'asc' },
    });
    return { data };
  }

  async create(tenantId: string, dto: any) {
    const rule = await this.prisma.routingRule.create({
      data: { ...dto, tenant_id: tenantId },
    });
    return { data: rule };
  }

  async update(id: string, tenantId: string, dto: any) {
    const rule = await this.prisma.routingRule.findFirst({ where: { id, tenant_id: tenantId } });
    if (!rule) throw new NotFoundException('Routing rule not found');

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.condition !== undefined) updateData.condition = dto.condition;
    if (dto.action !== undefined) updateData.action = dto.action;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.is_active !== undefined) updateData.is_active = dto.is_active;

    const updated = await this.prisma.routingRule.update({ where: { id }, data: updateData });
    return { data: updated };
  }

  async remove(id: string, tenantId: string) {
    const rule = await this.prisma.routingRule.findFirst({ where: { id, tenant_id: tenantId } });
    if (!rule) throw new NotFoundException('Routing rule not found');
    await this.prisma.routingRule.delete({ where: { id } });
    return { success: true, message: 'Routing rule deleted' };
  }
}
