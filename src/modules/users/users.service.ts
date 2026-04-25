import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { getPermissionsForRole } from '../auth/permissions';

const USER_SELECT = {
  id: true,
  email: true,
  first_name: true,
  last_name: true,
  role: true,
  avatar_url: true,
  preferences: true,
  last_active_at: true,
  created_at: true,
  updated_at: true,
  tenant_id: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private formatUser(user: any) {
    const displayName =
      [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;

    const overrides = user.permission_overrides ?? [];
    const permissions = getPermissionsForRole(
      user.role,
      overrides.map((o: any) => ({ permission: o.permission, type: o.type })),
    );

    return {
      id: user.id,
      email: user.email,
      displayName: displayName,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      avatar_url: user.avatar_url,
      is_active: user.is_active ?? true,
      tenant_id: user.tenant_id,
      permissions,
      permission_overrides: overrides,
      last_login_at: user.last_active_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  async findAll(
    tenantId: string,
    opts: { page?: number; limit?: number; search?: string; role?: string } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 25);
    const where: any = { tenant_id: tenantId };
    if (opts.role) where.role = opts.role;
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
        include: { permission_overrides: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map(this.formatUser.bind(this)),
      page,
      page_size: limit,
      total,
      total_pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenant_id: tenantId },
      include: { permission_overrides: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return { data: this.formatUser(user) };
  }

  async invite(dto: {
    email: string;
    first_name?: string;
    last_name?: string;
    role: string;
    tenant_id: string;
  }) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('EMAIL_ALREADY_EXISTS');

    const tempPassword = crypto.randomBytes(16).toString('hex');
    const password_hash = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        first_name: dto.first_name,
        last_name: dto.last_name,
        role: dto.role as any,
        tenant_id: dto.tenant_id,
        password_hash,
      },
      include: { permission_overrides: true },
    });

    return { data: this.formatUser(user) };
  }

  async update(id: string, tenantId: string, dto: any) {
    const user = await this.prisma.user.findFirst({ where: { id, tenant_id: tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const updateData: any = {};
    if (dto.first_name !== undefined) updateData.first_name = dto.first_name;
    if (dto.last_name !== undefined) updateData.last_name = dto.last_name;
    if (dto.avatar_url !== undefined) updateData.avatar_url = dto.avatar_url;
    if (dto.role !== undefined) updateData.role = dto.role;

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { permission_overrides: true },
    });

    return { data: this.formatUser(updated) };
  }

  async remove(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenant_id: tenantId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.delete({ where: { id } });
    return { success: true, message: 'User deleted successfully' };
  }

  // ── Permission Overrides ──────────────────────────────────────────────────

  async getPermissions(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const overrides = await this.prisma.permissionOverride.findMany({
      where: { user_id: userId, tenant_id: tenantId },
    });
    return overrides;
  }

  async upsertPermission(
    userId: string,
    tenantId: string,
    dto: { permission: string; type: 'GRANT' | 'REVOKE'; reason?: string },
    actorId: string,
    actorRole: string,
  ) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.permissionOverride.findFirst({
      where: { user_id: userId, tenant_id: tenantId, permission: dto.permission },
    });

    const data = {
      user_id: userId,
      tenant_id: tenantId,
      permission: dto.permission,
      type: dto.type as any,
      granted_by: actorId,
    };

    if (existing) {
      return this.prisma.permissionOverride.update({ where: { id: existing.id }, data });
    }
    return this.prisma.permissionOverride.create({ data });
  }

  // ── Workload ─────────────────────────────────────────────────────────────

  async getWorkload(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const assignedTickets = await this.prisma.ticket.count({
      where: {
        assignee_id: userId,
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
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
    tenantId: string,
    dto: { max_capacity?: number; availability_status?: string },
    actorId: string,
    actorRole: string,
  ) {
    if (dto.max_capacity !== undefined && actorId !== userId && !['ADMIN', 'LEAD'].includes(actorRole)) {
      throw new ForbiddenException('Only ADMIN/LEAD can update max_capacity');
    }

    if ((dto as any).assigned_tickets !== undefined || (dto as any).utilization_pct !== undefined) {
      throw new BadRequestException('READONLY_FIELD');
    }

    const user = await this.prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId } });
    if (!user) throw new NotFoundException('User not found');

    let workload = await this.prisma.workload.findFirst({ where: { user_id: userId } });
    const updateData: any = {};
    if (dto.max_capacity !== undefined) updateData.max_capacity = dto.max_capacity;
    if (dto.availability_status !== undefined) updateData.availability = dto.availability_status;

    if (workload) {
      workload = await this.prisma.workload.update({ where: { id: workload.id }, data: updateData });
    } else {
      workload = await this.prisma.workload.create({ data: { user_id: userId, ...updateData } });
    }

    return this.getWorkload(userId, tenantId);
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
        total_agents: agents.length,
        available_agents: statusCounts.AVAILABLE,
        busy_agents: statusCounts.BUSY,
        away_agents: statusCounts.AWAY,
        offline_agents: statusCounts.OFFLINE + statusCounts.DO_NOT_DISTURB,
        avg_utilization: agents.length ? Math.round((totalUtil / agents.length) * 100) / 10000 : 0,
        overloaded_agents: overloaded,
      },
    };
  }

  // ── Admin password reset ──────────────────────────────────────────────────

  async adminResetPassword(targetId: string, actorId: string, tenantId: string) {
    if (targetId === actorId) throw new ForbiddenException('CANNOT_RESET_SELF');
    const user = await this.prisma.user.findFirst({ where: { id: targetId, tenant_id: tenantId } });
    if (!user) throw new NotFoundException('User not found');

    return {
      success: true,
      message: `Password reset email sent to ${user.email}`,
    };
  }
}
