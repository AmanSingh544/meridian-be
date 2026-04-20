import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class KnowledgeBaseService {
  constructor(private prisma: PrismaService) {}

  async search(query: string, limit: number) {
    const articles = await this.prisma.kbArticle.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });
    return {
      data: articles.map((a) => ({
        article: a,
        score: 1.0,
        highlights: [a.title],
      })),
    };
  }

  async getCategories() {
    // Stub: categories are not a separate model in Prisma yet
    return { data: [] };
  }

  async findOne(id: string) {
    const article = await this.prisma.kbArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    await this.prisma.kbArticle.update({
      where: { id },
      data: { view_count: { increment: 1 } },
    });
    return { data: article };
  }

  async create(dto: any) {
    return this.prisma.kbArticle.create({
      data: { ...dto, slug: dto.title.toLowerCase().replace(/\s+/g, '-') },
    });
  }

  async update(id: string, dto: any) {
    const article = await this.prisma.kbArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
    return this.prisma.kbArticle.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.kbArticle.delete({ where: { id } });
    return { message: 'Article deleted' };
  }

  async voteHelpful(id: string) {
    await this.prisma.kbArticle.update({
      where: { id },
      data: { helpful_count: { increment: 1 } },
    });
    return { success: true };
  }
}
