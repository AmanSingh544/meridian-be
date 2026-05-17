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
        include: { deliveryItem: true },
      }),
      this.prisma.roadmapFeature.count({ where }),
    ]);
    return { data, page, page_size: limit, total, total_pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, tenantId: string) {
    const feature = await this.prisma.roadmapFeature.findFirst({
      where: { id, tenant_id: tenantId },
      include: { deliveryItem: true },
    });
    if (!feature) throw new NotFoundException('Feature not found');
    return { data: feature };
  }

  async create(tenantId: string, dto: any, createdBy: string) {
    // Create the delivery item first (source of truth) so the internal team sees it
    const deliveryItem = await this.prisma.deliveryItem.create({
      data: {
        tenant_id: tenantId,
        title: dto.title,
        description: dto.description,
        status: 'BACKLOG',
        is_public: true,
      },
    });

    // Create the linked roadmap feature (customer-facing view)
    const feature = await this.prisma.roadmapFeature.create({
      data: {
        tenant_id: tenantId,
        delivery_item_id: deliveryItem.id,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? 'planned',
        votes: 0,
        created_by: createdBy,
      },
    });

    return { data: feature };
  }

  async update(id: string, tenantId: string, dto: any) {
    const feature = await this.prisma.roadmapFeature.findFirst({
      where: { id, tenant_id: tenantId },
      include: { deliveryItem: true },
    });
    if (!feature) throw new NotFoundException('Feature not found');

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.status !== undefined) updateData.status = dto.status;

    const updated = await this.prisma.roadmapFeature.update({ where: { id }, data: updateData });

    // Sync title/description back to the source delivery item
    if (feature.deliveryItem) {
      const deliveryUpdate: any = {};
      if (dto.title !== undefined) deliveryUpdate.title = dto.title;
      if (dto.description !== undefined) deliveryUpdate.description = dto.description;
      if (Object.keys(deliveryUpdate).length > 0) {
        await this.prisma.deliveryItem.update({
          where: { id: feature.deliveryItem.id },
          data: deliveryUpdate,
        });
      }
    }

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
