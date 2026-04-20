import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const data = await this.prisma.onboardingItem.findMany({ orderBy: { created_at: 'desc' } });
    return { data };
  }

  async getMyOnboarding() {
    // Stub: return first onboarding item
    const data = await this.prisma.onboardingItem.findFirst();
    return { data };
  }

  async findOne(id: string) {
    const item = await this.prisma.onboardingItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Onboarding item not found');
    return { data: item };
  }

  async updateTask(id: string, taskId: string, dto: any) {
    // Stub: onboarding tasks are not a separate model yet
    return this.findOne(id);
  }
}
