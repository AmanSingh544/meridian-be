import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        avatar_url: true,
        last_active_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenant_id: tenantId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        avatar_url: true,
        preferences: true,
        last_active_at: true,
        created_at: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: any) {
    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : await bcrypt.hash(Math.random().toString(36).slice(-8), 10);

    return this.prisma.user.create({
      data: {
        ...dto,
        password_hash: passwordHash,
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        created_at: true,
      },
    });
  }

  async update(id: string, tenantId: string, dto: any) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    const updateData: any = { ...dto };
    if (dto.password) {
      updateData.password_hash = await bcrypt.hash(dto.password, 10);
      delete updateData.password;
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }
}
