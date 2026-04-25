import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  private formatOrg(org: any) {
    return {
      id: org.id,
      slug: org.slug,
      name: org.name,
      plan: org.plan,
      settings: org.settings,
      branding: org.branding,
      created_at: org.created_at,
      user_count: org._count?.users ?? 0,
      ticket_count: org._count?.tickets ?? 0,
    };
  }

  async findAll(page: number, limit: number, search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { users: true, tickets: true } } },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: data.map(this.formatOrg),
      page,
      page_size: limit,
      total,
      total_pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const org = await this.prisma.tenant.findUnique({
      where: { id },
      include: { _count: { select: { users: true, tickets: true } } },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return { data: this.formatOrg(org) };
  }

  async update(id: string, dto: any) {
    const org = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    if (!org) throw new NotFoundException('Organization not found');

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.plan !== undefined) updateData.plan = dto.plan;
    if (dto.settings !== undefined) updateData.settings = dto.settings;
    if (dto.branding !== undefined) updateData.branding = dto.branding;

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { users: true, tickets: true } } },
    });

    return { data: this.formatOrg(updated) };
  }
}
