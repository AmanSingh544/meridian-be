import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateOnboardingProjectDto, UpdateOnboardingProjectDto } from './dto/onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  // Internal console: returns one OnboardingProject per tenant (grouped from flat items)
  async findAll() {
    const allItems = await this.prisma.onboardingItem.findMany({
      orderBy: { created_at: 'asc' },
    });

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
    // id here is the tenant/org id (used as the project id)
    const resolvedTenantId = tenantId ?? id;
    const items = await this.prisma.onboardingItem.findMany({
      where: { tenant_id: resolvedTenantId },
      orderBy: { created_at: 'asc' },
    });
    if (items.length === 0) throw new NotFoundException('Onboarding project not found');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: resolvedTenantId }, select: { name: true } });
    return { data: this.buildProject(resolvedTenantId, tenant?.name ?? 'Unknown Organisation', items) };
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

    const allItems = await this.prisma.onboardingItem.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'asc' },
    });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    return { data: this.buildProject(tenantId, tenant?.name ?? 'Unknown Organisation', allItems) };
  }

  // Create a project: seeds the initial tasks for the given organisation
  async createProject(dto: CreateOnboardingProjectDto) {
    const { organization_id, go_live_date, tasks = [] } = dto;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: organization_id },
      select: { name: true },
    });
    if (!tenant) throw new NotFoundException('Organisation not found');

    const defaultDueDate = go_live_date ? new Date(go_live_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // If no tasks provided, seed a standard set
    const taskList = tasks.length > 0 ? tasks : this.defaultTasks();

    await this.prisma.onboardingItem.createMany({
      data: taskList.map((t) => ({
        tenant_id: organization_id,
        title: t.title,
        description: t.description ?? null,
        owner: t.owner ?? 'DELIVERY',
        status: 'pending',
        due_date: t.due_date ? new Date(t.due_date) : defaultDueDate,
      })),
    });

    const allItems = await this.prisma.onboardingItem.findMany({
      where: { tenant_id: organization_id },
      orderBy: { created_at: 'asc' },
    });
    return { data: this.buildProject(organization_id, tenant.name, allItems, go_live_date) };
  }

  // Update project-level fields: go-live date and status across all tasks
  async updateProject(id: string, dto: UpdateOnboardingProjectDto) {
    // id is the tenant/org id
    const items = await this.prisma.onboardingItem.findMany({ where: { tenant_id: id } });
    if (items.length === 0) throw new NotFoundException('Onboarding project not found');

    const tenant = await this.prisma.tenant.findUnique({ where: { id }, select: { name: true } });

    // Store go_live_date on all items as metadata via due_date update on the first item
    if (dto.go_live_date) {
      await this.prisma.onboardingItem.updateMany({
        where: { tenant_id: id },
        data: { due_date: new Date(dto.go_live_date) },
      });
    }

    const updatedItems = await this.prisma.onboardingItem.findMany({
      where: { tenant_id: id },
      orderBy: { created_at: 'asc' },
    });

    return { data: this.buildProject(id, tenant?.name ?? 'Unknown Organisation', updatedItems, dto.go_live_date) };
  }

  // Delete all onboarding tasks for an organisation (removes the project)
  async removeProject(organizationId: string) {
    const existing = await this.prisma.onboardingItem.findFirst({ where: { tenant_id: organizationId } });
    if (!existing) throw new NotFoundException('Onboarding project not found');

    await this.prisma.onboardingItem.deleteMany({ where: { tenant_id: organizationId } });
    return { success: true, message: 'Onboarding project deleted' };
  }

  async findMy(tenantId: string) {
    const items = await this.prisma.onboardingItem.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'asc' },
    });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    return { data: this.buildProject(tenantId, tenant?.name ?? 'Your Organisation', items) };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private buildProject(id: string, orgName: string, items: any[], goLiveDateOverride?: string) {
    const phases = this.buildPhases(items);
    const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
    const doneTasks = phases.reduce((sum, p) => sum + p.tasks.filter((t: any) => t.status === 'DONE').length, 0);
    const blockedTasks = phases.reduce((sum, p) => sum + p.tasks.filter((t: any) => t.status === 'BLOCKED').length, 0);
    const overallProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const firstItem = items[0];

    // Derive go-live date: override > latest due_date on items > +30 days
    const goLiveDate = goLiveDateOverride
      ? goLiveDateOverride
      : firstItem?.due_date
        ? (firstItem.due_date?.toISOString?.() ?? firstItem.due_date)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      id,
      organizationId: firstItem?.tenant_id ?? id,
      organizationName: orgName,
      leadAgentId: null,
      leadAgentName: '3SC Team',
      status: overallProgress >= 100 ? 'COMPLETED' : 'IN_PROGRESS',
      health: blockedTasks > 0 ? 'AT_RISK' : 'ON_TRACK',
      overallProgress,
      goLiveDate,
      blockerCount: blockedTasks,
      phases,
      created_at: firstItem?.created_at?.toISOString?.() ?? new Date().toISOString(),
      updated_at: firstItem?.updated_at?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  private buildPhases(items: any[]) {
    const phaseDefs = [
      { name: 'Kickoff & Setup', keywords: ['kickoff', 'environment', 'sso', 'setup', 'provision', 'account', 'access'] },
      { name: 'Data Migration', keywords: ['migration', 'export', 'mapping', 'import', 'transform', 'data'] },
      { name: 'UAT & Training', keywords: ['uat', 'training', 'test', 'review', 'sign-off', 'user acceptance', 'demo'] },
      { name: 'Go-Live', keywords: ['production', 'dns', 'go-live', 'cutover', 'live', 'launch', 'deploy'] },
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
        owner: item.owner ?? 'DELIVERY',
        dueDate: item.due_date?.toISOString?.() ?? item.due_date,
        status:
          item.status === 'done' ? 'DONE'
          : item.status === 'in_progress' ? 'IN_PROGRESS'
          : item.status === 'blocked' ? 'BLOCKED'
          : 'PENDING',
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

  private defaultTasks() {
    return [
      // Kickoff & Setup (Delivery)
      { title: 'Kickoff call with client stakeholders', description: 'Introduce the team, review goals and timeline.', owner: 'DELIVERY' },
      { title: 'Provision client environment', description: 'Set up tenant workspace and initial configuration.', owner: 'DELIVERY' },
      { title: 'SSO / identity provider setup', description: 'Configure SSO or invite-based access for client users.', owner: 'DELIVERY' },
      { title: 'Access provisioning and user roles', description: 'Create accounts and assign roles for key users.', owner: 'DELIVERY' },
      // Data Migration (Mixed)
      { title: 'Data export from legacy system', description: 'Client exports data in agreed format.', owner: 'CLIENT' },
      { title: 'Data mapping and field validation', description: 'Map legacy fields to Meridian schema.', owner: 'DELIVERY' },
      { title: 'Data import and integrity check', description: 'Import data and verify record counts and spot-checks.', owner: 'DELIVERY' },
      // UAT & Training (Mixed)
      { title: 'UAT environment ready', description: 'Confirm UAT environment is accessible and populated.', owner: 'DELIVERY' },
      { title: 'User acceptance testing (UAT)', description: 'Client completes UAT against agreed test scripts.', owner: 'CLIENT' },
      { title: 'Agent and admin training sessions', description: 'Deliver training to end-users and administrators.', owner: 'DELIVERY' },
      { title: 'UAT sign-off from client', description: 'Formal sign-off confirming readiness for go-live.', owner: 'CLIENT' },
      // Go-Live (Delivery)
      { title: 'Production environment setup', description: 'Provision and configure the production tenant.', owner: 'DELIVERY' },
      { title: 'DNS cutover', description: 'Update DNS records to point to the Meridian portal.', owner: 'DELIVERY' },
      { title: 'Go-live communication to users', description: 'Send launch comms and login instructions to all users.', owner: 'DELIVERY' },
      { title: 'Post-launch hypercare check', description: '48-hour check-in after go-live to address any issues.', owner: 'DELIVERY' },
    ];
  }

  // Legacy methods kept for backward compatibility
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
    if (dto.owner !== undefined) updateData.owner = dto.owner;
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
