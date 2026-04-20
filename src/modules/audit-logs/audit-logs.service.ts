import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number, pageSize: number, resourceType?: string, userId?: string) {
    const where: any = {};
    if (resourceType) where.resource_type = resourceType;
    if (userId) where.user_id = userId;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    };
  }
}
