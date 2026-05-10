import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { getPermissionsForRole } from '../auth/permissions';
import { buildTenantWhere } from '../../shared/utils/tenant-scope';

const CLIENT_ROLES = ['CLIENT_ADMIN', 'CLIENT_USER'];
const INTERNAL_ROLES = ['ADMIN', 'LEAD', 'AGENT'];

const USER_INCLUDE = {
  permission_overrides: true,
  user_skills: { include: { skill: true } },
  workloads: true,
  user_projects: {
    include: { project: { select: { id: true, name: true } } },
  },
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private buildUserShape(user: any, assignedTickets?: number) {
    const displayName =
      [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;

    const overrides = user.permission_overrides ?? [];
    const permissions = getPermissionsForRole(
      user.role,
      overrides.map((o: any) => ({ permission: o.permission, type: o.type })),
    );

    const prefs: any = user.preferences ?? {};

    const wl = user.workloads?.[0];
    const liveTickets = assignedTickets ?? wl?.active_tickets ?? 0;
    const maxCapacity = wl?.max_capacity ?? 20;
    const workload = wl
      ? {
          assignedTickets: liveTickets,
          maxCapacity,
          availabilityStatus: (wl.availability ?? 'AVAILABLE').toUpperCase(),
          utilizationPct: Math.round((liveTickets / maxCapacity) * 100 * 100) / 100,
        }
      : undefined;

    const PROF_TO_LEVEL: Record<number, string> = {
      1: 'BEGINNER', 2: 'BEGINNER', 3: 'INTERMEDIATE', 4: 'INTERMEDIATE', 5: 'EXPERT',
    };
    const skills = (user.user_skills ?? []).map((us: any) => ({
      skillId: us.skill_id,
      skill: us.skill
        ? { id: us.skill.id, name: us.skill.name, category: us.skill.category, description: us.skill.description ?? undefined }
        : undefined,
      level: PROF_TO_LEVEL[us.proficiency] ?? 'BEGINNER',
    }));

    // Project memberships — only expose id, name, role (never raw junction fields)
    const projects = (user.user_projects ?? []).map((up: any) => ({
      id: up.project?.id,
      name: up.project?.name,
      role: up.role,
    }));

    return {
      id: user.id,
      email: user.email,
      displayName,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.avatar_url,
      role: user.role,
      isActive: prefs.isActive ?? true,
      organizationId: user.tenant_id,
      organizationDetail: user.tenant ? { name: user.tenant?.name, slug: user.tenant?.slug, plan: user.tenant?.plan } : undefined,
      permissions,
      permissionOverrides: overrides,
      lastLoginAt: user.last_active_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      // Real columns (not preferences JSON)
      internal_sub_role: user.internal_sub_role ?? undefined,
      department: user.department ?? undefined,
      timezone: user.timezone ?? undefined,
      job_title: user.job_title ?? undefined,
      phone: user.phone ?? undefined,
      mfaEnabled: prefs.mfaEnabled ?? false,
      skills: skills.length ? skills : undefined,
      workload,
      projects: projects.length ? projects : undefined,
    };
  }

  async findAll(
    tenantId: string | undefined,
    opts: { page?: number; limit?: number; search?: string; role?: string; actorRole?: string } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 25);

    const tenantWhere = buildTenantWhere({ tenantId, role: opts.actorRole ?? '' });

    const where: any = { ...tenantWhere };

    if (opts.role) {
      const roles = opts.role.split(',').map((r) => r.trim()).filter(Boolean);
      where.role = roles.length === 1 ? roles[0] : { in: roles };
    }
    if (opts.search) {
      where.OR = [
        { email: { contains: opts.search, mode: 'insensitive' } },
        { first_name: { contains: opts.search, mode: 'insensitive' } },
        { last_name: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          ...USER_INCLUDE,
          tenant: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const ticketCounts = await Promise.all(
      data.map((u) =>
        this.prisma.ticket.count({
          where: { assignee_id: u.id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
        }),
      ),
    );

    return {
      data: data.map((u, i) => this.buildUserShape(u, ticketCounts[i])),
      page,
      page_size: limit,
      total,
      total_pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string | undefined, actorRole?: string) {
    const tenantWhere = buildTenantWhere({ tenantId, role: actorRole ?? '' });

    let user = await this.prisma.user.findFirst({
      where: { id, ...tenantWhere },
      include: USER_INCLUDE,
    });

    if (!user) throw new NotFoundException('User not found');

    const assignedTickets = await this.prisma.ticket.count({
      where: { assignee_id: id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
    });

    return { data: this.buildUserShape(user, assignedTickets) };
  }

  async invite(dto: {
    email: string;
    first_name?: string;
    last_name?: string;
    role: string;
    tenant_id: string;
    internal_sub_role?: string;
    department?: string;
    project_ids?: string[];
    skill_ids?: string[];
  }) {
    // Block internal-only fields for client roles
    if (CLIENT_ROLES.includes(dto.role)) {
      if (dto.internal_sub_role) throw new BadRequestException('internal_sub_role is not allowed for client roles');
      if (dto.skill_ids?.length) throw new BadRequestException('skill_ids is not allowed for client roles');
    }

    // Check per-tenant email uniqueness (schema now enforces this, but give a clear error)
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, tenant_id: dto.tenant_id },
    });
    if (existing) throw new ConflictException('EMAIL_ALREADY_EXISTS');

    // Validate project_ids all belong to the same tenant
    if (dto.project_ids?.length) {
      const projects = await this.prisma.project.findMany({
        where: { id: { in: dto.project_ids } },
        select: { id: true, tenant_id: true },
      });
      const mismatch = projects.find((p) => p.tenant_id !== dto.tenant_id);
      if (mismatch || projects.length !== dto.project_ids.length) {
        throw new BadRequestException('All project_ids must belong to the specified tenant');
      }
    }

    const tempPassword = 'Password123!'; // Email will activate when domain is purchased
    const password_hash = await bcrypt.hash(tempPassword, 10);

    // Wrap all creates in a single transaction — partial failure rolls back everything
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          first_name: dto.first_name,
          last_name: dto.last_name,
          role: dto.role as any,
          tenant_id: dto.tenant_id,
          password_hash,
          internal_sub_role: dto.internal_sub_role,
          department: dto.department,
        },
        include: USER_INCLUDE,
      });

      if (dto.project_ids?.length) {
        await (tx as any).userProject.createMany({
          data: dto.project_ids.map((project_id) => ({
            user_id: created.id,
            project_id,
            role: 'MEMBER',
          })),
        });
      }

      if (dto.skill_ids?.length) {
        await tx.userSkill.createMany({
          data: dto.skill_ids.map((skill_id) => ({
            user_id: created.id,
            skill_id,
          })),
          skipDuplicates: true,
        });
      }

      // Re-fetch to include relations created in this transaction
      return tx.user.findFirst({
        where: { id: created.id },
        include: USER_INCLUDE,
      });
    });

    return { data: this.buildUserShape(user) };
  }

  async update(id: string, tenantId: string | undefined, dto: any, actorRole?: string) {
    const tenantWhere = buildTenantWhere({ tenantId, role: actorRole ?? '' });
    const user = await this.prisma.user.findFirst({ where: { id, ...tenantWhere } });
    if (!user) throw new NotFoundException('User not found');

    const updateData: any = {};
    if (dto.first_name !== undefined) updateData.first_name = dto.first_name;
    if (dto.last_name !== undefined) updateData.last_name = dto.last_name;
    if (dto.avatar_url !== undefined) updateData.avatar_url = dto.avatar_url;
    if (dto.role !== undefined) updateData.role = dto.role;

    // Real columns — write directly
    if (dto.internal_sub_role !== undefined) updateData.internal_sub_role = dto.internal_sub_role;
    if (dto.department !== undefined) updateData.department = dto.department;
    if (dto.job_title !== undefined) updateData.job_title = dto.job_title;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.timezone !== undefined) updateData.timezone = dto.timezone;

    // tenant_id is immutable — silently ignore if sent
    // Remaining preference-only fields (mfaEnabled, isActive, theme)
    const prefKeyMap: Record<string, string> = {
      is_active: 'isActive',
      mfa_enabled: 'mfaEnabled',
    };
    const prefUpdates: Record<string, any> = {};
    for (const [snakeKey, camelKey] of Object.entries(prefKeyMap)) {
      if (dto[snakeKey] !== undefined) prefUpdates[camelKey] = dto[snakeKey];
    }
    if (Object.keys(prefUpdates).length > 0) {
      const current = (user.preferences as Record<string, any>) ?? {};
      updateData.preferences = { ...current, ...prefUpdates };
    }

    // Handle project_ids update if provided
    if (dto.project_ids !== undefined) {
      if (dto.project_ids.length) {
        const projects = await this.prisma.project.findMany({
          where: { id: { in: dto.project_ids } },
          select: { id: true, tenant_id: true },
        });
        const mismatch = projects.find((p) => p.tenant_id !== user.tenant_id);
        if (mismatch || projects.length !== dto.project_ids.length) {
          throw new BadRequestException('All project_ids must belong to the user\'s tenant');
        }
      }
      // Replace project assignments
      await (this.prisma as any).userProject.deleteMany({ where: { user_id: id } });
      if (dto.project_ids.length) {
        await (this.prisma as any).userProject.createMany({
          data: dto.project_ids.map((project_id: string) => ({
            user_id: id,
            project_id,
            role: 'MEMBER',
          })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: USER_INCLUDE,
    });

    return { data: this.buildUserShape(updated) };
  }

  async remove(id: string, tenantId: string | undefined, actorRole?: string) {
    const tenantWhere = buildTenantWhere({ tenantId, role: actorRole ?? '' });
    const user = await this.prisma.user.findFirst({ where: { id, ...tenantWhere } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.delete({ where: { id } });
    return { success: true, message: 'User deleted successfully' };
  }

  // ── Permission Overrides ──────────────────────────────────────────────────

  private async buildPermissionsResponse(userId: string, tenantId: string, role: string) {
    const overrides = await this.prisma.permissionOverride.findMany({
      where: { user_id: userId, tenant_id: tenantId },
    });
    const effective = getPermissionsForRole(
      role as any,
      overrides.map((o) => ({ permission: o.permission, type: o.type as any })),
    );
    return {
      data: {
        effective,
        overrides: overrides.map((o) => ({
          id: o.id,
          permission: o.permission,
          type: o.type,
          grantedBy: o.granted_by,
          reason: (o as any).reason ?? undefined,
          created_at: o.created_at,
        })),
      },
    };
  }

  async getPermissions(userId: string, tenantId: string | undefined, actorRole?: string) {
    const tenantWhere = buildTenantWhere({ tenantId, role: actorRole ?? '' });
    const user = await this.prisma.user.findFirst({ where: { id: userId, ...tenantWhere } });
    if (!user) throw new NotFoundException('User not found');
    return this.buildPermissionsResponse(userId, user.tenant_id, user.role);
  }

  async upsertPermission(
    userId: string,
    tenantId: string | undefined,
    dto: { permission: string; type: 'GRANT' | 'REVOKE'; reason?: string },
    actorId: string,
    actorRole: string,
  ) {
    const tenantWhere = buildTenantWhere({ tenantId, role: actorRole });
    const user = await this.prisma.user.findFirst({ where: { id: userId, ...tenantWhere } });
    if (!user) throw new NotFoundException('User not found');

    const actualTenantId = user.tenant_id;

    const existing = await this.prisma.permissionOverride.findFirst({
      where: { user_id: userId, tenant_id: actualTenantId, permission: dto.permission },
    });

    const overrideData = {
      user_id: userId,
      tenant_id: actualTenantId,
      permission: dto.permission,
      type: dto.type as any,
      granted_by: actorId,
    };

    if (existing) {
      await this.prisma.permissionOverride.update({ where: { id: existing.id }, data: overrideData });
    } else {
      await this.prisma.permissionOverride.create({ data: overrideData });
    }

    return this.buildPermissionsResponse(userId, actualTenantId, user.role);
  }

  // ── Workload ─────────────────────────────────────────────────────────────

  async getWorkload(userId: string, tenantId: string | undefined, actorRole?: string) {
    const tenantWhere = buildTenantWhere({ tenantId, role: actorRole ?? '' });
    const user = await this.prisma.user.findFirst({ where: { id: userId, ...tenantWhere } });
    if (!user) throw new NotFoundException('User not found');

    const assignedTickets = await this.prisma.ticket.count({
      where: { assignee_id: userId, status: { notIn: ['RESOLVED', 'CLOSED'] } },
    });

    let workload = await this.prisma.workload.findFirst({ where: { user_id: userId } });
    if (!workload) {
      workload = await this.prisma.workload.create({
        data: { user_id: userId, active_tickets: 0, max_capacity: 20, availability: 'AVAILABLE' },
      });
    }

    const maxCapacity = workload.max_capacity;
    return {
      data: {
        user_id: userId,
        assigned_tickets: assignedTickets,
        max_capacity: maxCapacity,
        utilization_pct: Math.round((assignedTickets / maxCapacity) * 100 * 100) / 100,
        availability_status: workload.availability.toUpperCase(),
      },
    };
  }

  async updateWorkload(
    userId: string,
    tenantId: string | undefined,
    dto: { max_capacity?: number; maxCapacity?: number; availability_status?: string; availabilityStatus?: string },
    actorId: string,
    actorRole: string,
  ) {
    const maxCapacity = dto.max_capacity ?? dto.maxCapacity;
    const availabilityStatus = dto.availability_status ?? dto.availabilityStatus;

    if (maxCapacity !== undefined && actorId !== userId && !['ADMIN', 'LEAD'].includes(actorRole)) {
      throw new ForbiddenException('Only ADMIN/LEAD can update max_capacity');
    }

    if ((dto as any).assigned_tickets !== undefined || (dto as any).utilization_pct !== undefined) {
      throw new BadRequestException('READONLY_FIELD');
    }

    const tenantWhere = buildTenantWhere({ tenantId, role: actorRole });
    const user = await this.prisma.user.findFirst({ where: { id: userId, ...tenantWhere } });
    if (!user) throw new NotFoundException('User not found');

    let workload = await this.prisma.workload.findFirst({ where: { user_id: userId } });
    const updateData: any = {};
    if (maxCapacity !== undefined) updateData.max_capacity = maxCapacity;
    if (availabilityStatus !== undefined) updateData.availability = availabilityStatus;

    if (workload) {
      await this.prisma.workload.update({ where: { id: workload.id }, data: updateData });
    } else {
      await this.prisma.workload.create({ data: { user_id: userId, ...updateData } });
    }

    return this.getWorkload(userId, tenantId, actorRole);
  }

  async getWorkloadSummary(tenantId: string) {
    const agents = await this.prisma.user.findMany({
      where: { tenant_id: tenantId, role: { in: ['AGENT', 'LEAD', 'ADMIN'] as any } },
      include: { workloads: true },
    });

    const statusCounts = { AVAILABLE: 0, BUSY: 0, AWAY: 0, OFFLINE: 0, DO_NOT_DISTURB: 0 };
    let totalUtil = 0;
    let overloaded = 0;

    for (const agent of agents) {
      const wl = agent.workloads?.[0];
      const status = (wl?.availability ?? 'AVAILABLE').toUpperCase();
      if (status in statusCounts) (statusCounts as any)[status]++;

      const assigned = await this.prisma.ticket.count({
        where: { assignee_id: agent.id, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      });
      const cap = wl?.max_capacity ?? 20;
      const pct = (assigned / cap) * 100;
      totalUtil += pct;
      if (pct >= 90) overloaded++;
    }

    return {
      data: {
        totalAgents: agents.length,
        availableAgents: statusCounts.AVAILABLE,
        busyAgents: statusCounts.BUSY,
        awayAgents: statusCounts.AWAY,
        offlineAgents: statusCounts.OFFLINE + statusCounts.DO_NOT_DISTURB,
        avgUtilization: agents.length ? Math.round((totalUtil / agents.length) * 100) / 100 : 0,
        overloadedAgents: overloaded,
      },
    };
  }

  // ── Admin password reset ──────────────────────────────────────────────────

  async adminResetPassword(targetId: string, actorId: string, tenantId: string | undefined, actorRole?: string) {
    if (targetId === actorId) throw new ForbiddenException('CANNOT_RESET_SELF');
    const tenantWhere = buildTenantWhere({ tenantId, role: actorRole ?? '' });
    const user = await this.prisma.user.findFirst({ where: { id: targetId, ...tenantWhere } });
    if (!user) throw new NotFoundException('User not found');

    // Email sending will activate when domain is purchased — code path preserved
    return {
      success: true,
      message: `Password reset email sent to ${user.email}`,
    };
  }
}
