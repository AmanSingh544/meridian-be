import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, tenantId: string, page: number, limit: number, unreadOnly?: boolean) {
    const where: any = { user_id: userId, tenant_id: tenantId };
    if (unreadOnly) where.is_read = false;

    const [data, total, unread_count] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { user_id: userId, tenant_id: tenantId, is_read: false } }),
    ]);

    return {
      data,
      page,
      page_size: limit,
      total,
      total_pages: Math.ceil(total / limit),
      unread_count,
    };
  }

  async markRead(id: string, userId: string, tenantId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id, user_id: userId, tenant_id: tenantId },
    });
    if (!notif) throw new NotFoundException('Notification not found');

    await this.prisma.notification.update({
      where: { id },
      data: { is_read: true, read_at: new Date() },
    });
    return { data: { success: true } };
  }

  async markAllRead(userId: string, tenantId: string) {
    await this.prisma.notification.updateMany({
      where: { user_id: userId, tenant_id: tenantId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
    return { data: { success: true } };
  }

  async remove(id: string, userId: string, tenantId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id, user_id: userId, tenant_id: tenantId },
    });
    if (!notif) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({ where: { id } });
    return { success: true };
  }

  async create(dto: {
    tenant_id: string;
    user_id: string;
    type: string;
    title: string;
    body?: string;
    data?: any;
  }) {
    const notif = await this.prisma.notification.create({ data: dto });
    return { data: notif };
  }
}
