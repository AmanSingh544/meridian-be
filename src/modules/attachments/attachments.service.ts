import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class AttachmentsService {
  constructor(private prisma: PrismaService) {}

  // Called by the frontend when it already has a file_path (local/direct upload flow)
  async create(dto: {
    file_name: string;
    file_type: string;
    file_path: string;
    tenant_id: string;
    ticket_id?: string;
    uploaded_by?: string;
    metadata?: Record<string, any>;
  }) {
    if (!dto.tenant_id) throw new BadRequestException('tenant_id is required');

    const attachment = await this.prisma.attachment.create({
      data: {
        tenant_id: dto.tenant_id,
        ticket_id: dto.ticket_id ?? null,
        filename: dto.file_name,
        mime_type: dto.file_type,
        storage_key: dto.file_path,
        uploaded_by: dto.uploaded_by ?? null,
        size_bytes: null,
      },
    });

    return {
      data: this.formatAttachment(attachment),
    };
  }

  async presign(dto: { file_name: string; mime_type: string }) {
    const fileKey = `uploads/${Date.now()}/${dto.file_name}`;
    return {
      data: {
        upload_url: `https://storage.example.com/presign/${fileKey}`,
        file_key: fileKey,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
    };
  }

  async confirm(dto: { file_key: string; ticket_id?: string; tenant_id?: string }) {
    const attachment = await this.prisma.attachment.create({
      data: {
        tenant_id: dto.tenant_id ?? '',
        ticket_id: dto.ticket_id ?? null,
        filename: dto.file_key.split('/').pop() ?? dto.file_key,
        mime_type: 'application/octet-stream',
        storage_key: dto.file_key,
        size_bytes: null,
      },
    });

    return { data: this.formatAttachment(attachment) };
  }

  private formatAttachment(a: any) {
    return {
      id: a.id,
      file_name: a.filename,
      file_type: a.mime_type,
      file_path: a.storage_key,
      tenant_id: a.tenant_id,
      ticket_id: a.ticket_id,
      size_bytes: a.size_bytes,
      created_at: a.created_at,
    };
  }
}
