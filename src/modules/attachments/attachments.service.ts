import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly uploadsDir: string;

  constructor(private prisma: PrismaService) {
    this.uploadsDir = path.resolve(process.cwd(), 'uploads', 'attachments');
    this.ensureUploadsDir();
  }

  private ensureUploadsDir() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  // Called by the controller after Multer has written the file to disk
  async create(dto: {
    file: Express.Multer.File;
    tenant_id: string;
    uploaded_by?: string;
    ticket_id?: string;
    project_id?: string;
  }) {
    if (!dto.tenant_id) throw new BadRequestException('tenant_id is required');
    if (!dto.file) throw new BadRequestException('file is required');

    const safeProjectId = /^[a-zA-Z0-9-_]+$/.test(dto.project_id ?? '')
      ? dto.project_id!
      : 'general';

    // storage_key is POSIX-style relative path: tenantId/projectId/filename
    const storageKey = path.posix.join(dto.tenant_id, safeProjectId, dto.file.filename);

    const attachment = await this.prisma.attachment.create({
      data: {
        tenant_id: dto.tenant_id,
        ticket_id: dto.ticket_id ?? null,
        filename: dto.file.originalname,
        mime_type: dto.file.mimetype,
        storage_key: storageKey,
        size_bytes: dto.file.size,
        uploaded_by: dto.uploaded_by ?? null,
      },
    });

    this.logger.log(
      `Upload: id=${attachment.id} tenant=${dto.tenant_id} user=${dto.uploaded_by ?? 'unknown'} file=${attachment.filename} size=${attachment.size_bytes}`
    );

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

  async findForDownload(
    id: string,
    jwtTenantId: string,
    jwtRole: string,
    jwtUserId: string,
  ) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: { ticket: { select: { id: true, project_id: true, tenant_id: true, requester_id: true } } },
    });

    if (!attachment) throw new NotFoundException('Attachment not found');

    const isInternalUser = ['ADMIN', 'LEAD', 'AGENT'].includes(jwtRole);
    const isClientAdmin = jwtRole === 'CLIENT_ADMIN';
    const isClientUser = jwtRole === 'CLIENT_USER';

    if (isInternalUser) {
      // ADMIN can access everything.
      // LEAD and AGENT can access any attachment they can see via a ticket or comment,
      // or orphan attachments within their own tenant.
      if (jwtRole !== 'ADMIN') {
        const isOwnTenantOrphan =
          !attachment.ticket_id &&
          !attachment.comment_id &&
          attachment.tenant_id !== jwtTenantId;
        if (isOwnTenantOrphan) {
          throw new ForbiddenException('You cannot access this attachment');
        }
      }
    } else if (isClientAdmin) {
      // CLIENT_ADMIN can access any attachment belonging to their tenant
      if (attachment.tenant_id !== jwtTenantId) {
        throw new ForbiddenException('You cannot access attachments from another tenant');
      }
    } else if (isClientUser) {
      // CLIENT_USER can only access attachments on tickets they raised
      if (attachment.tenant_id !== jwtTenantId) {
        throw new ForbiddenException('You cannot access attachments from another tenant');
      }
      if (attachment.ticket_id) {
        if (!attachment.ticket || attachment.ticket.requester_id !== jwtUserId) {
          throw new ForbiddenException('You can only access attachments on your own tickets');
        }
      } else if (!attachment.comment_id) {
        // Orphan attachment — only allow the uploader
        if (attachment.uploaded_by !== jwtUserId) {
          throw new ForbiddenException('You can only access your own attachments');
        }
      }
    } else {
      throw new ForbiddenException('You do not have permission to download attachments');
    }

    const filePath = path.join(this.uploadsDir, ...attachment.storage_key.split('/'));

    // Path traversal protection
    const basePath = fs.realpathSync(this.uploadsDir);
    let resolved: string;
    try {
      resolved = fs.realpathSync(filePath);
    } catch {
      throw new NotFoundException('File not found');
    }
    if (!resolved.startsWith(basePath)) {
      throw new ForbiddenException('Invalid file path');
    }
    if (!fs.existsSync(resolved)) {
      throw new NotFoundException('File not found on disk');
    }

    this.logger.log(
      `Download: id=${id} tenant=${jwtTenantId} user=${jwtUserId} file=${attachment.filename}`
    );

    return {
      filePath: resolved,
      filename: this.sanitizeFilename(attachment.filename),
      rawFilename: attachment.filename,
      mimeType: attachment.mime_type || 'application/octet-stream',
      attachment: this.formatAttachment(attachment),
    };
  }

  async delete(
    id: string,
    jwtTenantId: string,
    jwtRole: string,
    jwtUserId: string,
  ) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) throw new NotFoundException('Attachment not found');

    // Tenant isolation
    if (jwtRole !== 'ADMIN' && attachment.tenant_id !== jwtTenantId) {
      throw new ForbiddenException('You cannot delete attachments from another tenant');
    }

    // Ownership / permission check
    const canDelete = ['ADMIN', 'LEAD'].includes(jwtRole) || attachment.uploaded_by === jwtUserId;
    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete this attachment');
    }

    // Delete file from disk
    const filePath = path.join(this.uploadsDir, ...attachment.storage_key.split('/'));
    try {
      const basePath = fs.realpathSync(this.uploadsDir);
      const resolved = fs.realpathSync(filePath);
      if (resolved.startsWith(basePath) && fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
      }
    } catch (err) {
      this.logger.warn(`Failed to delete file for attachment ${id}: ${(err as Error).message}`);
    }

    await this.prisma.attachment.delete({ where: { id } });

    this.logger.log(
      `Delete: id=${id} tenant=${jwtTenantId} user=${jwtUserId} file=${attachment.filename}`
    );

    return { data: { id }, message: 'Attachment deleted successfully' };
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
      created_at: a.created_at.toISOString(),
    };
  }
}
