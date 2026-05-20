import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }

    const rawToken = authHeader.slice(7);
    const keyHash = createHash('sha256').update(rawToken).digest('hex');

    const apiKey = await this.prisma.projectApiKey.findUnique({
      where: { key_hash: keyHash },
      include: { creator: { include: { tenant: true, permission_overrides: true } } },
    });

    if (!apiKey || !apiKey.is_active) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    if (apiKey.expires_at && apiKey.expires_at < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Stamp last_used_at without blocking the request
    this.prisma.projectApiKey
      .update({ where: { id: apiKey.id }, data: { last_used_at: new Date() } })
      .catch(() => undefined);

    req.user = {
      userId: apiKey.created_by,
      email: apiKey.creator.email,
      role: apiKey.creator.role,
      tenantId: apiKey.tenant_id,
    };

    return true;
  }
}
