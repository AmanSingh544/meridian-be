import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class DeliveryService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const data = await this.prisma.deliveryItem.findMany({ orderBy: { created_at: 'desc' } });
    return { data };
  }

  async create(dto: any) {
    return this.prisma.deliveryItem.create({ data: dto });
  }

  async update(id: string, dto: any) {
    const item = await this.prisma.deliveryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Delivery item not found');
    return this.prisma.deliveryItem.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.deliveryItem.delete({ where: { id } });
    return { message: 'Delivery item deleted' };
  }
}
