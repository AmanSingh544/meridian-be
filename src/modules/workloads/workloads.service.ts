import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class WorkloadsService {
  constructor(private prisma: PrismaService) {}

  async getUserWorkload(userId: string) {
    const workload = await this.prisma.workload.findUnique({
      where: { user_id: userId },
    });
    if (!workload) {
      // Create default workload if not exists
      return this.prisma.workload.create({
        data: { user_id: userId, active_tickets: 0, max_capacity: 10, availability: 'available' },
      });
    }
    return workload;
  }

  async updateUserWorkload(userId: string, dto: any) {
    const workload = await this.prisma.workload.findUnique({ where: { user_id: userId } });
    if (!workload) {
      return this.prisma.workload.create({
        data: { user_id: userId, ...dto },
      });
    }
    return this.prisma.workload.update({
      where: { user_id: userId },
      data: dto,
    });
  }

  async getWorkloadSummary() {
    const workloads = await this.prisma.workload.findMany();
    return {
      data: {
        total_agents: workloads.length,
        available: workloads.filter((w) => w.availability === 'available').length,
        busy: workloads.filter((w) => w.availability === 'busy').length,
        away: workloads.filter((w) => w.availability === 'away').length,
        avg_utilization: workloads.length
          ? workloads.reduce((sum, w) => sum + (w.active_tickets / w.max_capacity), 0) / workloads.length
          : 0,
      },
    };
  }
}
