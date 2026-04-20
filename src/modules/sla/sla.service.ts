import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class SlaService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const data = await this.prisma.slaPolicy.findMany({ orderBy: { created_at: 'desc' } });
    return { data };
  }

  async create(dto: any) {
    return this.prisma.slaPolicy.create({ data: dto });
  }

  async update(id: string, dto: any) {
    const policy = await this.prisma.slaPolicy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundException('SLA policy not found');
    return this.prisma.slaPolicy.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.slaPolicy.delete({ where: { id } });
    return { message: 'SLA policy deleted' };
  }
}
