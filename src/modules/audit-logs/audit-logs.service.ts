import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    opts: {
      page?: number;
      limit?: number;
      resource_type?: string;
      user_id?: string;
      action?: string;
      date_from?: string;
      date_to?: string;
    } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 25);
    const where: any = { tenant_id: tenantId };

    if (opts.resource_type) where.resource_type = opts.resource_type;
    if (opts.user_id) where.user_id = opts.user_id;
    if (opts.action) where.action = opts.action;
    if (opts.date_from || opts.date_to) {
      where.created_at = {};
      if (opts.date_from) where.created_at.gte = new Date(opts.date_from);
      if (opts.date_to) where.created_at.lte = new Date(opts.date_to);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: { id: true, first_name: true, last_name: true, email: true, role: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const data = logs.map((log) => ({
      id: log.id,
      tenant_id: log.tenant_id,
      user_id: log.user_id,
      actor: log.user
        ? {
            display_name:
              [log.user.first_name, log.user.last_name].filter(Boolean).join(' ') || log.user.email,
            email: log.user.email,
            role: log.user.role,
          }
        : null,
      action: log.action,
      resource_type: log.resource_type,
      resource_id: log.resource_id,
      changes: log.changes,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      created_at: log.created_at,
    }));

    return { data, page, page_size: limit, total, total_pages: Math.ceil(total / limit) };
  }

  async create(dto: {
    tenant_id: string;
    user_id?: string;
    action: string;
    resource_type: string;
    resource_id?: string;
    changes?: any;
    ip_address?: string;
    user_agent?: string;
  }) {
    return this.prisma.auditLog.create({ data: dto });
  }
}
