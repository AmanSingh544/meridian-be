import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, page: number, limit: number, search?: string, status?: string) {
    const where: any = { tenant_id: tenantId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [raw, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);
    const data = raw.map((p: any) => ({
      ...p,
      scope: p.metadata?.scope,
      targetDate: p.metadata?.targetDate,
      milestones: p.metadata?.milestones ?? [],
      ticketCount: p.metadata?.ticketCount ?? 0,
      openTicketCount: p.metadata?.openTicketCount ?? 0,
      resolvedThisWeek: p.metadata?.resolvedThisWeek ?? 0,
    }));
    return { data, page, page_size: limit, total, total_pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, tenantId: string) {
    const project = await this.prisma.project.findFirst({ where: { id, tenant_id: tenantId } });
    if (!project) throw new NotFoundException('Project not found');
    return {
      data: {
        ...project,
        scope: (project as any).metadata?.scope,
        targetDate: (project as any).metadata?.targetDate,
        milestones: (project as any).metadata?.milestones ?? [],
        ticketCount: (project as any).metadata?.ticketCount ?? 0,
        openTicketCount: (project as any).metadata?.openTicketCount ?? 0,
        resolvedThisWeek: (project as any).metadata?.resolvedThisWeek ?? 0,
      },
    };
  }

  async create(tenantId: string, dto: any) {
    const { scope, target_date, metadata, ...rest } = dto;
    const project = await this.prisma.project.create({
      data: {
        ...rest,
        tenant_id: tenantId,
        metadata: { ...(metadata ?? {}), ...(scope !== undefined ? { scope } : {}), ...(target_date !== undefined ? { targetDate: target_date } : {}) },
      },
    });
    return { data: { ...project, scope: (project.metadata as any)?.scope, targetDate: (project.metadata as any)?.targetDate } };
  }

  async update(id: string, tenantId: string, dto: any) {
    const project = await this.prisma.project.findFirst({ where: { id, tenant_id: tenantId } });
    if (!project) throw new NotFoundException('Project not found');

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.client_id !== undefined) updateData.client_id = dto.client_id;
    if (dto.health_score !== undefined) updateData.health_score = dto.health_score;
    const existingMeta = (project.metadata as any) ?? {};
    const metaPatch: any = {};
    if (dto.scope !== undefined) metaPatch.scope = dto.scope;
    if (dto.target_date !== undefined) metaPatch.targetDate = dto.target_date;
    if (dto.metadata !== undefined || Object.keys(metaPatch).length > 0) {
      updateData.metadata = { ...existingMeta, ...(dto.metadata ?? {}), ...metaPatch };
    }

    const updated = await this.prisma.project.update({ where: { id }, data: updateData });
    return { data: updated };
  }

  async remove(id: string, tenantId: string) {
    const project = await this.prisma.project.findFirst({ where: { id, tenant_id: tenantId } });
    if (!project) throw new NotFoundException('Project not found');
    await this.prisma.project.delete({ where: { id } });
    return { success: true, message: 'Project deleted' };
  }
}
