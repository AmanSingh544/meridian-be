import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

  async findAll(category?: string, search?: string) {
    const where: any = {};
    if (category) where.category = category;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const data = await this.prisma.skill.findMany({ where, orderBy: { name: 'asc' } });
    return { data };
  }

  async create(dto: any) {
    return this.prisma.skill.create({ data: dto });
  }

  async getUserSkills(userId: string) {
    const data = await this.prisma.userSkill.findMany({
      where: { user_id: userId },
      include: { skill: true },
    });
    return { data };
  }

  async updateUserSkills(userId: string, dto: any) {
    // Delete existing and recreate
    await this.prisma.userSkill.deleteMany({ where: { user_id: userId } });
    const created = await this.prisma.userSkill.createMany({
      data: dto.skill_ids.map((skillId: string) => ({
        user_id: userId,
        skill_id: skillId,
        proficiency: 1,
      })),
    });
    return this.getUserSkills(userId);
  }
}
