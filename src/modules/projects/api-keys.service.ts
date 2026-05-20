import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateApiKeyDto, ApiKeyResponseDto } from './dto/api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async create(
    projectId: string,
    tenantId: string,
    creatorId: string,
    dto: CreateApiKeyDto,
  ): Promise<ApiKeyResponseDto> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const raw = 'mk_' + randomBytes(32).toString('hex');
    const keyHash = createHash('sha256').update(raw).digest('hex');
    const keyPrefix = raw.slice(0, 11); // "mk_" + first 8 hex chars

    const key = await this.prisma.projectApiKey.create({
      data: {
        tenant_id: tenantId,
        project_id: projectId,
        name: dto.name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        created_by: creatorId,
        expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
      },
    });

    return { ...this.toResponse(key), raw_token: raw };
  }

  async findAll(projectId: string, tenantId: string): Promise<{ data: ApiKeyResponseDto[] }> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const keys = await this.prisma.projectApiKey.findMany({
      where: { project_id: projectId, tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
    });

    return { data: keys.map((k) => this.toResponse(k)) };
  }

  async revoke(keyId: string, projectId: string, tenantId: string): Promise<void> {
    const key = await this.prisma.projectApiKey.findFirst({
      where: { id: keyId, project_id: projectId, tenant_id: tenantId },
    });
    if (!key) throw new NotFoundException('API key not found');
    if (!key.is_active) throw new ForbiddenException('API key is already revoked');

    await this.prisma.projectApiKey.update({
      where: { id: keyId },
      data: { is_active: false },
    });
  }

  private toResponse(key: any): ApiKeyResponseDto {
    return {
      id: key.id,
      name: key.name,
      key_prefix: key.key_prefix,
      tenant_id: key.tenant_id,
      project_id: key.project_id,
      created_by: key.created_by,
      last_used_at: key.last_used_at,
      expires_at: key.expires_at,
      is_active: key.is_active,
      created_at: key.created_at,
    };
  }
}
