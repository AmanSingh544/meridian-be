import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class RoadmapService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, opts: { page?: number; limit?: number; status?: string } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 25);
    const where: any = { tenant_id: tenantId };
    if (opts.status) where.status = opts.status;

    const [data, total] = await Promise.all([
      this.prisma.roadmapFeature.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { votes: 'desc' },
      }),
      this.prisma.roadmapFeature.count({ where }),
    ]);
    return { data, page, page_size: limit, total, total_pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, tenantId: string) {
    const feature = await this.prisma.roadmapFeature.findFirst({ where: { id, tenant_id: tenantId } });
    if (!feature) throw new NotFoundException('Feature not found');
    return { data: feature };
  }

  async create(tenantId: string, dto: any, createdBy: string) {
    const feature = await this.prisma.roadmapFeature.create({
      data: { ...dto, tenant_id: tenantId, created_by: createdBy, status: dto.status ?? 'planned', votes: 0 },
    });
    return { data: feature };
  }

  async update(id: string, tenantId: string, dto: any) {
    const feature = await this.prisma.roadmapFeature.findFirst({ where: { id, tenant_id: tenantId } });
    if (!feature) throw new NotFoundException('Feature not found');

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.status !== undefined) updateData.status = dto.status;

    const updated = await this.prisma.roadmapFeature.update({ where: { id }, data: updateData });
    return { data: updated };
  }

  async vote(id: string, tenantId: string) {
    const feature = await this.prisma.roadmapFeature.findFirst({ where: { id, tenant_id: tenantId } });
    if (!feature) throw new NotFoundException('Feature not found');
    const updated = await this.prisma.roadmapFeature.update({
      where: { id },
      data: { votes: { increment: 1 } },
    });
    return { data: { feature_id: updated.id, upvotes: updated.votes, has_voted: true } };
  }

  async unvote(id: string, tenantId: string) {
    const feature = await this.prisma.roadmapFeature.findFirst({ where: { id, tenant_id: tenantId } });
    if (!feature) throw new NotFoundException('Feature not found');
    const updated = await this.prisma.roadmapFeature.update({
      where: { id },
      data: { votes: { decrement: 1 } },
    });
    return { data: { feature_id: updated.id, upvotes: updated.votes, has_voted: false } };
  }
}
