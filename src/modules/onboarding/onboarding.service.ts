import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  // Internal console: returns one OnboardingProject per tenant (grouped from flat items)
  async findAll() {
    const allItems = await this.prisma.onboardingItem.findMany({
      orderBy: { created_at: 'asc' },
    });

    // Group items by tenant_id
    const byTenant = new Map<string, typeof allItems>();
    for (const item of allItems) {
      if (!byTenant.has(item.tenant_id)) byTenant.set(item.tenant_id, []);
      byTenant.get(item.tenant_id)!.push(item);
    }

    const tenantIds = [...byTenant.keys()];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

    const projects = tenantIds.map((tenantId) => {
      const items = byTenant.get(tenantId)!;
      return this.buildProject(tenantId, tenantMap.get(tenantId) ?? 'Unknown Organisation', items);
    });

    return { data: projects };
  }

  async findOne(id: string, tenantId: string) {
    const items = await this.prisma.onboardingItem.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'asc' },
    });
    if (items.length === 0) throw new NotFoundException('Onboarding project not found');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    return { data: this.buildProject(id, tenant?.name ?? 'Unknown Organisation', items) };
  }

  async updateTask(tenantId: string, taskId: string, dto: any) {
    const item = await this.prisma.onboardingItem.findFirst({ where: { id: taskId, tenant_id: tenantId } });
    if (!item) throw new NotFoundException('Onboarding task not found');

    const statusMap: Record<string, string> = {
      DONE: 'done',
      IN_PROGRESS: 'in_progress',
      PENDING: 'pending',
      BLOCKED: 'blocked',
    };

    const updateData: any = {};
    if (dto.status !== undefined) updateData.status = statusMap[dto.status] ?? dto.status;

    await this.prisma.onboardingItem.update({ where: { id: taskId }, data: updateData });

    // Return the full updated project so the UI can refresh state
    const allItems = await this.prisma.onboardingItem.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'asc' },
    });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    return { data: this.buildProject(tenantId, tenant?.name ?? 'Unknown Organisation', allItems) };
  }

  private buildProject(id: string, orgName: string, items: any[]) {
    const phases = this.buildPhases(items);
    const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
    const doneTasks = phases.reduce((sum, p) => sum + p.tasks.filter((t: any) => t.status === 'DONE').length, 0);
    const blockedTasks = phases.reduce((sum, p) => sum + p.tasks.filter((t: any) => t.status === 'BLOCKED').length, 0);
    const overallProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const firstItem = items[0];

    return {
      id,
      organizationId: firstItem?.tenant_id ?? id,
      organizationName: orgName,
      leadAgentId: null,
      leadAgentName: '3SC Team',
      status: overallProgress >= 100 ? 'COMPLETED' : overallProgress > 0 ? 'IN_PROGRESS' : 'IN_PROGRESS',
      health: blockedTasks > 0 ? 'AT_RISK' : 'ON_TRACK',
      overallProgress,
      goLiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      blockerCount: blockedTasks,
      phases,
      created_at: firstItem?.created_at?.toISOString?.() ?? new Date().toISOString(),
      updated_at: firstItem?.updated_at?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  async findMy(tenantId: string) {
    const items = await this.prisma.onboardingItem.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'asc' },
    });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    return { data: this.buildProject(tenantId, tenant?.name ?? 'Your Organisation', items) };
  }

  private buildPhases(items: any[]) {
    // Heuristic grouping into 4 standard phases
    const phaseDefs = [
      { name: 'Kickoff & Setup', keywords: ['kickoff', 'environment', 'sso', 'setup', 'provision'] },
      { name: 'Data Migration', keywords: ['migration', 'export', 'mapping', 'import', 'transform'] },
      { name: 'UAT & Training', keywords: ['uat', 'training', 'test', 'review', 'sign-off'] },
      { name: 'Go-Live', keywords: ['production', 'dns', 'go-live', 'cutover', 'live'] },
    ];

    const phases = phaseDefs.map((def, idx) => ({
      id: `PH-MY-${idx + 1}`,
      phaseNumber: idx + 1,
      name: def.name,
      progress: 0,
      status: 'PENDING',
      tasks: [] as any[],
    }));

    for (const item of items) {
      const title = (item.title ?? '').toLowerCase();
      let phaseIdx = 0;
      for (let i = 0; i < phaseDefs.length; i++) {
        if (phaseDefs[i].keywords.some((k) => title.includes(k))) {
          phaseIdx = i;
          break;
        }
      }
      phases[phaseIdx].tasks.push({
        id: item.id,
        title: item.title,
        description: item.description,
        owner: 'DELIVERY',
        dueDate: item.due_date?.toISOString?.() ?? item.due_date,
        status: item.status === 'done' ? 'DONE' : item.status === 'in_progress' ? 'IN_PROGRESS' : item.status === 'blocked' ? 'BLOCKED' : 'PENDING',
        completedAt: item.status === 'done' ? (item.updated_at?.toISOString?.() ?? item.updated_at) : undefined,
      });
    }

    for (const phase of phases) {
      const done = phase.tasks.filter((t: any) => t.status === 'DONE').length;
      phase.progress = phase.tasks.length > 0 ? Math.round((done / phase.tasks.length) * 100) : 0;
      if (done === phase.tasks.length && phase.tasks.length > 0) phase.status = 'COMPLETED';
      else if (done > 0) phase.status = 'IN_PROGRESS';
    }

    return phases.filter((p) => p.tasks.length > 0);
  }

  async create(tenantId: string, dto: any) {
    const item = await this.prisma.onboardingItem.create({
      data: { ...dto, tenant_id: tenantId },
    });
    return { data: item };
  }

  async update(id: string, tenantId: string, dto: any) {
    const item = await this.prisma.onboardingItem.findFirst({ where: { id, tenant_id: tenantId } });
    if (!item) throw new NotFoundException('Onboarding item not found');

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.assignee_id !== undefined) updateData.assignee_id = dto.assignee_id;
    if (dto.due_date !== undefined) updateData.due_date = dto.due_date ? new Date(dto.due_date) : null;

    const updated = await this.prisma.onboardingItem.update({ where: { id }, data: updateData });
    return { data: updated };
  }

  async remove(id: string, tenantId: string) {
    const item = await this.prisma.onboardingItem.findFirst({ where: { id, tenant_id: tenantId } });
    if (!item) throw new NotFoundException('Onboarding item not found');
    await this.prisma.onboardingItem.delete({ where: { id } });
    return { success: true, message: 'Onboarding item deleted' };
  }
}
