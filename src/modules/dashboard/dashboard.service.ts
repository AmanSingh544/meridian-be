import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getKpis() {
    const total = await this.prisma.ticket.count();
    const openTickets = await this.prisma.ticket.count({ where: { status: 'OPEN' } });
    const resolvedToday = 0; // Stub: implement date filtering

    return {
      data: {
        total,
        open_tickets: openTickets,
        resolved_today: resolvedToday,
        avg_resolution_time: '2d 4h',
        sla_compliance_rate: 0.92,
        by_priority: { LOW: 8, MEDIUM: 15, HIGH: 18, CRITICAL: 6 },
        by_status: { OPEN: 12, ACKNOWLEDGED: 5, IN_PROGRESS: 18, RESOLVED: 8, CLOSED: 4 },
        recent_activity: [],
      },
    };
  }
}
