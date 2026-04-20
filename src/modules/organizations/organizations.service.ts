import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take: pageSize,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              tickets: true,
            },
          },
        },
      }),
      this.prisma.tenant.count(),
    ]);

    const formatted = data.map((org) => ({
      ...org,
      user_count: org._count.users,
      ticket_count: org._count.tickets,
      _count: undefined,
    }));

    return {
      data: formatted,
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const org = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            tickets: true,
          },
        },
      },
    });

    if (!org) throw new NotFoundException('Organization not found');

    return {
      data: {
        ...org,
        user_count: org._count.users,
        ticket_count: org._count.tickets,
        _count: undefined,
      },
    };
  }

  async update(id: string, dto: any) {
    const org = await this.prisma.tenant.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        plan: dto.plan,
        settings: dto.settings,
        branding: dto.branding,
      },
    });

    return { data: updated };
  }
}
