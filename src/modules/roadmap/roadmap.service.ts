import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class RoadmapService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const data = await this.prisma.roadmapFeature.findMany({ orderBy: { votes: 'desc' } });
    return { data };
  }

  async vote(id: string) {
    const feature = await this.prisma.roadmapFeature.findUnique({ where: { id } });
    if (!feature) throw new NotFoundException('Feature not found');
    const updated = await this.prisma.roadmapFeature.update({
      where: { id },
      data: { votes: { increment: 1 } },
    });
    return { feature_id: updated.id, upvotes: updated.votes, has_voted: true };
  }

  async unvote(id: string) {
    const feature = await this.prisma.roadmapFeature.findUnique({ where: { id } });
    if (!feature) throw new NotFoundException('Feature not found');
    const updated = await this.prisma.roadmapFeature.update({
      where: { id },
      data: { votes: { decrement: 1 } },
    });
    return { feature_id: updated.id, upvotes: updated.votes, has_voted: false };
  }

  async submitRequest(dto: any) {
    return this.prisma.roadmapFeature.create({
      data: { ...dto, status: 'planned', votes: 0 },
    });
  }
}
