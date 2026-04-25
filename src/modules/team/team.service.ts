import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { getPermissionsForRole } from '../auth/permissions';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  private formatMember(user: any) {
    const overrides = user.permission_overrides ?? [];
    const permissions = getPermissionsForRole(
      user.role,
      overrides.map((o: any) => ({ permission: o.permission, type: o.type })),
    );
    return {
      id: user.id,
      email: user.email,
      display_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      avatar_url: user.avatar_url,
      is_active: user.is_active ?? true,
      tenant_id: user.tenant_id,
      permissions,
      last_login_at: user.last_active_at,
      created_at: user.created_at,
    };
  }

  async findMembers(tenantId: string, page: number, limit: number, search?: string, role?: string) {
    const where: any = { tenant_id: tenantId };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;

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
      data: data.map(this.formatMember.bind(this)),
      page,
      page_size: limit,
      total,
      total_pages: Math.ceil(total / limit),
    };
  }

  async changeRole(memberId: string, tenantId: string, role: string, actorId: string) {
    const member = await this.prisma.user.findFirst({ where: { id: memberId, tenant_id: tenantId } });
    if (!member) throw new NotFoundException('Member not found');
    if (memberId === actorId) throw new ForbiddenException('Cannot change own role');

    // Clear permission overrides on role change
    await this.prisma.permissionOverride.deleteMany({ where: { user_id: memberId, tenant_id: tenantId } });

    const updated = await this.prisma.user.update({
      where: { id: memberId },
      data: { role: role as any },
      include: { permission_overrides: true },
    });

    return { data: this.formatMember(updated) };
  }

  async togglePermission(
    memberId: string,
    tenantId: string,
    dto: { permission: string; type: 'GRANT' | 'REVOKE'; reason?: string },
    actorId: string,
  ) {
    const member = await this.prisma.user.findFirst({ where: { id: memberId, tenant_id: tenantId } });
    if (!member) throw new NotFoundException('Member not found');

    const existing = await this.prisma.permissionOverride.findFirst({
      where: { user_id: memberId, tenant_id: tenantId, permission: dto.permission },
    });

    if (existing) {
      await this.prisma.permissionOverride.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.permissionOverride.create({
        data: {
          user_id: memberId,
          tenant_id: tenantId,
          permission: dto.permission,
          type: dto.type as any,
          granted_by: actorId,
        },
      });
    }

    const updatedUser = await this.prisma.user.findFirst({
      where: { id: memberId },
      include: { permission_overrides: true },
    });
    return { data: this.formatMember(updatedUser) };
  }

  async deactivateMember(memberId: string, tenantId: string, actorId: string) {
    const member = await this.prisma.user.findFirst({ where: { id: memberId, tenant_id: tenantId } });
    if (!member) throw new NotFoundException('Member not found');
    if (memberId === actorId) throw new ForbiddenException('Cannot deactivate self');

    await this.prisma.user.delete({ where: { id: memberId } });
    return { success: true, message: 'Member deactivated' };
  }

  async getScoringWeights() {
    return { data: { w_skill: 0.5, w_workload: 0.35, w_avail: 0.15 } };
  }

  async updateScoringWeights(dto: any) {
    return { data: dto };
  }
}
