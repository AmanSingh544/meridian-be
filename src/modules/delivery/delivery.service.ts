import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class DeliveryService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, opts: { page?: number; limit?: number; status?: string } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 25);
    const where: any = { tenant_id: tenantId };
    if (opts.status) where.status = opts.status;

    const [data, total] = await Promise.all([
      this.prisma.deliveryItem.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { roadmapFeature: true },
      }),
      this.prisma.deliveryItem.count({ where }),
    ]);

    const dataWithVotes = data.map(item => ({
      ...item,
      upvotes: item.roadmapFeature?.votes ?? item.upvotes,
    }));

    return { data: dataWithVotes, page, page_size: limit, total, total_pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, tenantId: string) {
    const item = await this.prisma.deliveryItem.findFirst({
      where: { id, tenant_id: tenantId },
      include: { roadmapFeature: true },
    });
    if (!item) throw new NotFoundException('Delivery item not found');

    return { data: { ...item, upvotes: item.roadmapFeature?.votes ?? item.upvotes } };
  }

  async create(tenantId: string, dto: any) {
    const item = await this.prisma.deliveryItem.create({
      data: { ...dto, tenant_id: tenantId },
    });

    if (item.is_public) {
      await this.prisma.roadmapFeature.create({
        data: {
          tenant_id: tenantId,
          delivery_item_id: item.id,
          title: item.title,
          description: item.description,
          status: 'planned',
          votes: 0,
        },
      });
    }

    return { data: item };
  }

  async update(id: string, tenantId: string, dto: any) {
    const item = await this.prisma.deliveryItem.findFirst({
      where: { id, tenant_id: tenantId },
      include: { roadmapFeature: true },
    });
    if (!item) throw new NotFoundException('Delivery item not found');

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.quarter !== undefined) updateData.quarter = dto.quarter;
    if (dto.is_public !== undefined) updateData.is_public = dto.is_public;
    if (dto.upvotes !== undefined) updateData.upvotes = dto.upvotes;
    if (dto.assignee_id !== undefined) updateData.assignee_id = dto.assignee_id;
    if (dto.due_date !== undefined) updateData.due_date = dto.due_date ? new Date(dto.due_date) : null;

    const updated = await this.prisma.deliveryItem.update({ where: { id }, data: updateData });

    const wasPublic = item.is_public;
    const isPublic = dto.is_public !== undefined ? dto.is_public : wasPublic;
    const hasRoadmapFeature = !!item.roadmapFeature;

    if (!wasPublic && isPublic && !hasRoadmapFeature) {
      // Became public — create linked roadmap feature
      await this.prisma.roadmapFeature.create({
        data: {
          tenant_id: tenantId,
          delivery_item_id: id,
          title: updated.title,
          description: updated.description,
          status: 'planned',
          votes: 0,
        },
      });
    } else if (wasPublic && !isPublic && hasRoadmapFeature) {
      // Became private — delete linked roadmap feature
      await this.prisma.roadmapFeature.delete({ where: { id: item.roadmapFeature.id } });
    } else if (hasRoadmapFeature && isPublic) {
      // Sync title/description changes to roadmap
      const roadmapUpdate: any = {};
      if (dto.title !== undefined) roadmapUpdate.title = dto.title;
      if (dto.description !== undefined) roadmapUpdate.description = dto.description;
      if (Object.keys(roadmapUpdate).length > 0) {
        await this.prisma.roadmapFeature.update({
          where: { id: item.roadmapFeature.id },
          data: roadmapUpdate,
        });
      }
    }

    return { data: updated };
  }

  async remove(id: string, tenantId: string) {
    const item = await this.prisma.deliveryItem.findFirst({ where: { id, tenant_id: tenantId } });
    if (!item) throw new NotFoundException('Delivery item not found');
    await this.prisma.deliveryItem.delete({ where: { id } });
    return { success: true, message: 'Delivery item deleted' };
  }
}
