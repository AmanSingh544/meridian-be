import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { buildTenantWhere, TenantContext } from '../../shared/utils/tenant-scope';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  private async liveTicketCounts(projectIds: string[]): Promise<Map<string, { total: number; open: number; resolvedThisWeek: number }>> {
    if (!projectIds.length) return new Map();

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [totals, opens, resolved] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['project_id'],
        where: { project_id: { in: projectIds } },
        _count: { id: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['project_id'],
        where: { project_id: { in: projectIds }, status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } },
        _count: { id: true },
      }),
      this.prisma.ticket.groupBy({
        by: ['project_id'],
        where: { project_id: { in: projectIds }, status: { in: ['RESOLVED', 'CLOSED'] }, resolved_at: { gte: weekAgo } },
        _count: { id: true },
      }),
    ]);

    const map = new Map<string, { total: number; open: number; resolvedThisWeek: number }>();
    for (const pid of projectIds) {
      map.set(pid, { total: 0, open: 0, resolvedThisWeek: 0 });
    }
    for (const row of totals)   if (row.project_id) map.get(row.project_id)!.total            = row._count.id;
    for (const row of opens)    if (row.project_id) map.get(row.project_id)!.open             = row._count.id;
    for (const row of resolved) if (row.project_id) map.get(row.project_id)!.resolvedThisWeek = row._count.id;
    return map;
  }

  async findAll(ctx: TenantContext, page: number, limit: number, search?: string, status?: string) {
    const where: any = { ...buildTenantWhere(ctx) };
    // Allow ADMIN to scope by tenant when explicitly provided as a filter
    if (ctx.role === 'ADMIN' && ctx.tenantId) where.tenant_id = ctx.tenantId;
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

    const counts = await this.liveTicketCounts(raw.map((p: any) => p.id));

    const data = raw.map((p: any) => {
      const c = counts.get(p.id) ?? { total: 0, open: 0, resolvedThisWeek: 0 };
      return {
        ...p,
        scope: p.metadata?.scope,
        targetDate: p.metadata?.targetDate,
        milestones: p.metadata?.milestones ?? [],
        ticketCount: c.total,
        openTicketCount: c.open,
        resolvedThisWeek: c.resolvedThisWeek,
      };
    });
    return { data, page, page_size: limit, total, total_pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, ctx: TenantContext) {
    const project = await this.prisma.project.findFirst({ where: { id, ...buildTenantWhere(ctx) } });
    if (!project) throw new NotFoundException('Project not found');

    const counts = await this.liveTicketCounts([id]);
    const c = counts.get(id) ?? { total: 0, open: 0, resolvedThisWeek: 0 };

    return {
      data: {
        ...project,
        scope: (project as any).metadata?.scope,
        targetDate: (project as any).metadata?.targetDate,
        milestones: (project as any).metadata?.milestones ?? [],
        ticketCount: c.total,
        openTicketCount: c.open,
        resolvedThisWeek: c.resolvedThisWeek,
      },
    };
  }

  async create(ctx: TenantContext, dto: any) {
    const { scope, target_date, metadata, ...rest } = dto;
    // For project creation, tenant_id must be explicit — ADMIN must specify which client
    if (!ctx.tenantId) throw new BadRequestException('tenant_id is required to create a project');
    const project = await this.prisma.project.create({
      data: {
        ...rest,
        tenant_id: ctx.tenantId,
        metadata: { ...(metadata ?? {}), ...(scope !== undefined ? { scope } : {}), ...(target_date !== undefined ? { targetDate: target_date } : {}) },
      },
    });
    return { data: { ...project, scope: (project.metadata as any)?.scope, targetDate: (project.metadata as any)?.targetDate } };
  }

  async update(id: string, ctx: TenantContext, dto: any) {
    const project = await this.prisma.project.findFirst({ where: { id, ...buildTenantWhere(ctx) } });
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

  async remove(id: string, ctx: TenantContext) {
    const project = await this.prisma.project.findFirst({ where: { id, ...buildTenantWhere(ctx) } });
    if (!project) throw new NotFoundException('Project not found');
    await this.prisma.project.delete({ where: { id } });
    return { success: true, message: 'Project deleted' };
  }

  // ── Project Members ───────────────────────────────────────────────────────

  async getMembers(projectId: string, ctx: TenantContext) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, ...buildTenantWhere(ctx) } });
    if (!project) throw new NotFoundException('Project not found');

    const members = await (this.prisma as any).userProject.findMany({
      where: { project_id: projectId },
      include: {
        user: {
          select: {
            id: true, email: true, first_name: true, last_name: true,
            avatar_url: true, role: true, tenant_id: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    return {
      data: members.map((m: any) => ({
        id: m.user.id,
        email: m.user.email,
        displayName: [m.user.first_name, m.user.last_name].filter(Boolean).join(' ') || m.user.email,
        firstName: m.user.first_name,
        lastName: m.user.last_name,
        avatarUrl: m.user.avatar_url,
        role: m.user.role,
        project_role: m.role,
        joined_at: m.created_at,
      })),
    };
  }

  async addMember(projectId: string, ctx: TenantContext, dto: { user_id: string; role?: string }) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, ...buildTenantWhere(ctx) } });
    if (!project) throw new NotFoundException('Project not found');

    // Validate the user exists; ADMINs can assign cross-tenant users (e.g. internal agents)
    const userWhere: any = { id: dto.user_id };
    if (ctx.role !== 'ADMIN') userWhere.tenant_id = project.tenant_id;
    const user = await this.prisma.user.findFirst({ where: userWhere });
    if (!user) throw new BadRequestException('User not found');

    const existing = await (this.prisma as any).userProject.findFirst({
      where: { user_id: dto.user_id, project_id: projectId },
    });
    if (existing) throw new BadRequestException('User is already a member of this project');

    await (this.prisma as any).userProject.create({
      data: {
        user_id: dto.user_id,
        project_id: projectId,
        role: dto.role ?? 'MEMBER',
      },
    });

    return this.getMembers(projectId, ctx);
  }

  async removeMember(projectId: string, userId: string, ctx: TenantContext) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, ...buildTenantWhere(ctx) } });
    if (!project) throw new NotFoundException('Project not found');

    const membership = await (this.prisma as any).userProject.findFirst({
      where: { user_id: userId, project_id: projectId },
    });
    if (!membership) throw new NotFoundException('User is not a member of this project');

    await (this.prisma as any).userProject.delete({ where: { id: membership.id } });
    return this.getMembers(projectId, ctx);
  }
}
