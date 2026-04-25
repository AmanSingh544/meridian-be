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
      }),
      this.prisma.deliveryItem.count({ where }),
    ]);
    return { data, page, page_size: limit, total, total_pages: Math.ceil(total / limit) };
  }

  async findOne(id: string, tenantId: string) {
    const item = await this.prisma.deliveryItem.findFirst({ where: { id, tenant_id: tenantId } });
    if (!item) throw new NotFoundException('Delivery item not found');
    return { data: item };
  }

  async create(tenantId: string, dto: any) {
    const item = await this.prisma.deliveryItem.create({
      data: { ...dto, tenant_id: tenantId },
    });
    return { data: item };
  }

  async update(id: string, tenantId: string, dto: any) {
    const item = await this.prisma.deliveryItem.findFirst({ where: { id, tenant_id: tenantId } });
    if (!item) throw new NotFoundException('Delivery item not found');

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.assignee_id !== undefined) updateData.assignee_id = dto.assignee_id;
    if (dto.due_date !== undefined) updateData.due_date = dto.due_date ? new Date(dto.due_date) : null;

    const updated = await this.prisma.deliveryItem.update({ where: { id }, data: updateData });
    return { data: updated };
  }

  async remove(id: string, tenantId: string) {
    const item = await this.prisma.deliveryItem.findFirst({ where: { id, tenant_id: tenantId } });
    if (!item) throw new NotFoundException('Delivery item not found');
    await this.prisma.deliveryItem.delete({ where: { id } });
    return { success: true, message: 'Delivery item deleted' };
  }
}
