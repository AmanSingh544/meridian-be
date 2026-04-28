import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

const LEVEL_TO_PROFICIENCY: Record<string, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 3,
  EXPERT: 5,
};

const PROFICIENCY_TO_LEVEL: Record<number, string> = {
  1: 'BEGINNER',
  2: 'BEGINNER',
  3: 'INTERMEDIATE',
  4: 'INTERMEDIATE',
  5: 'EXPERT',
};

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, category?: string, search?: string) {
    const where: any = { tenant_id: tenantId };
    if (category) where.category = category;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const data = await this.prisma.skill.findMany({ where, orderBy: { name: 'asc' } });
    return { data };
  }

  async create(tenantId: string, dto: { name: string; category?: string; description?: string }) {
    const existing = await this.prisma.skill.findFirst({
      where: { tenant_id: tenantId, name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('SKILL_NAME_EXISTS');

    const skill = await this.prisma.skill.create({
      data: { ...dto, tenant_id: tenantId },
    });
    return { data: skill };
  }

  async update(id: string, tenantId: string, dto: { name?: string; category?: string; description?: string }) {
    const skill = await this.prisma.skill.findFirst({ where: { id, tenant_id: tenantId } });
    if (!skill) throw new NotFoundException('Skill not found');

    if (dto.name && dto.name !== skill.name) {
      const existing = await this.prisma.skill.findFirst({
        where: { tenant_id: tenantId, name: { equals: dto.name, mode: 'insensitive' }, NOT: { id } },
      });
      if (existing) throw new ConflictException('SKILL_NAME_EXISTS');
    }

    const updated = await this.prisma.skill.update({ where: { id }, data: dto });
    return { data: updated };
  }

  async remove(id: string, tenantId: string) {
    const skill = await this.prisma.skill.findFirst({ where: { id, tenant_id: tenantId } });
    if (!skill) throw new NotFoundException('Skill not found');
    await this.prisma.skill.delete({ where: { id } });
    return { success: true, message: 'Skill deleted' };
  }

  async getUserSkills(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const userSkills = await this.prisma.userSkill.findMany({
      where: { user_id: userId },
      include: { skill: true },
    });

    return {
      data: userSkills.map((us) => ({
        id: us.id,
        skill_id: us.skill_id,
        skill: {
          id: us.skill.id,
          name: us.skill.name,
          category: us.skill.category,
          description: us.skill.description ?? undefined,
        },
        proficiency: us.proficiency,
        level: PROFICIENCY_TO_LEVEL[us.proficiency] ?? 'BEGINNER',
        created_at: us.created_at,
      })),
    };
  }

  async replaceUserSkills(
    userId: string,
    tenantId: string,
    skills: Array<{ skill_id: string; proficiency?: number; level?: string }>,
  ) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.userSkill.deleteMany({ where: { user_id: userId } });

    if (skills.length > 0) {
      await this.prisma.userSkill.createMany({
        data: skills.map((s) => ({
          user_id: userId,
          skill_id: s.skill_id,
          proficiency: s.proficiency ?? (s.level ? (LEVEL_TO_PROFICIENCY[s.level] ?? 1) : 1),
        })),
      });
    }

    return this.getUserSkills(userId, tenantId);
  }
}
