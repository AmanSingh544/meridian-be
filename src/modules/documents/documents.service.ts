import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  DOCUMENT_DEPARTMENTS,
  ListDocumentsQueryDto,
  UpdateDocumentDto,
} from './dto/document.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly uploadsDir: string;

  constructor(private prisma: PrismaService) {
    this.uploadsDir = path.resolve(process.cwd(), 'uploads', 'documents');
    this.ensureUploadsDir();
  }

  private ensureUploadsDir() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  private getTenantDir(tenantId: string): string {
    const tenantDir = path.join(this.uploadsDir, tenantId);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }
    return tenantDir;
  }

  private isInternal(role: string): boolean {
    return ['AGENT', 'LEAD', 'ADMIN'].includes(role);
  }

  private resolveTenantId(
    jwtTenantId: string,
    jwtRole: string,
    requestedTenantId?: string,
  ): string {
    if (jwtRole === 'ADMIN' && requestedTenantId) {
      return requestedTenantId;
    }
    return jwtTenantId;
  }

  private canManageDocument(
    actorRole: string,
    actorId: string,
    docUploadedBy: string,
  ): boolean {
    if (actorRole === 'ADMIN' || actorRole === 'LEAD') return true;
    if (actorRole === 'AGENT') return docUploadedBy === actorId;
    return false;
  }

  // ── LIST ────────────────────────────────────────────────────────────────────
  async findAll(
    query: ListDocumentsQueryDto,
    jwtTenantId: string,
    jwtRole: string,
  ) {
    let tenantId = this.resolveTenantId(
      jwtTenantId,
      jwtRole,
      query.tenant_id,
    );

    // Client users can only see their own tenant
    if (!this.isInternal(jwtRole) && tenantId !== jwtTenantId) {
      throw new ForbiddenException('You cannot access documents from another tenant');
    }

    // Internal admins can see all tenants unless explicitly filtering to a different one
    if (jwtRole === 'ADMIN' && query.tenant_id === jwtTenantId) {
      tenantId = undefined;
    }

    const where: any = {};
    if (tenantId) {
      where.tenant_id = tenantId;
    }

    if (query.department) {
      where.department = query.department;
    }

    if (query.search) {
      where.filename = { contains: query.search, mode: 'insensitive' };
    }

    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [query.sort_by ?? 'created_at']: query.sort_order ?? 'desc' },
        include: {
          uploader: {
            select: { id: true, first_name: true, last_name: true, email: true },
          },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      data: data.map((d) => this.formatDocument(d)),
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    };
  }

  // ── STATS ───────────────────────────────────────────────────────────────────
  async getStats(
    queryTenantId: string | undefined,
    jwtTenantId: string,
    jwtRole: string,
  ) {
    let tenantId = this.resolveTenantId(
      jwtTenantId,
      jwtRole,
      queryTenantId,
    );

    if (!this.isInternal(jwtRole) && tenantId !== jwtTenantId) {
      throw new ForbiddenException('You cannot access documents from another tenant');
    }

    // Internal admins can see stats for all tenants unless explicitly filtering to a different one
    if (jwtRole === 'ADMIN' && queryTenantId === jwtTenantId) {
      tenantId = undefined;
    }

    const where: any = {};
    if (tenantId) {
      where.tenant_id = tenantId;
    }

    const [totalFiles, totalDownloadsResult, departmentsResult] =
      await Promise.all([
        this.prisma.document.count({ where }),
        this.prisma.document.aggregate({
          where,
          _sum: { download_count: true },
        }),
        this.prisma.document.groupBy({
          by: ['department'],
          where,
        }),
      ]);

    return {
      total_files: totalFiles,
      total_departments: departmentsResult.length,
      total_downloads: totalDownloadsResult._sum.download_count ?? 0,
    };
  }

  // ── UPLOAD ──────────────────────────────────────────────────────────────────
  async create(
    file: Express.Multer.File,
    body: { filename: string; department: string; target_tenant_id?: string },
    jwtTenantId: string,
    jwtRole: string,
    jwtUserId: string,
  ) {
    if (!this.isInternal(jwtRole)) {
      throw new ForbiddenException('Only internal users can upload documents');
    }

    const tenantId = this.resolveTenantId(
      jwtTenantId,
      jwtRole,
      body.target_tenant_id,
    );

    if (!DOCUMENT_DEPARTMENTS.includes(body.department as any)) {
      throw new BadRequestException('Invalid department');
    }

    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: PDF, Word, Excel, PowerPoint, images, videos, text`,
      );
    }

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException(
        `File exceeds maximum size of ${MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024}MB`,
      );
    }

    const ext = path.extname(file.originalname) || '';
    const storageName = `${uuidv4()}${ext}`;
    const tenantDir = this.getTenantDir(tenantId);
    const filePath = path.join(tenantDir, storageName);

    fs.writeFileSync(filePath, file.buffer);

    const doc = await this.prisma.document.create({
      data: {
        tenant_id: tenantId,
        department: body.department,
        filename: body.filename || file.originalname,
        storage_name: storageName,
        mime_type: file.mimetype,
        size_bytes: file.size,
        uploaded_by: jwtUserId,
      },
      include: {
        uploader: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
    });

    return { data: this.formatDocument(doc) };
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateDocumentDto,
    jwtTenantId: string,
    jwtRole: string,
    jwtUserId: string,
  ) {
    if (!this.isInternal(jwtRole)) {
      throw new ForbiddenException('Only internal users can edit documents');
    }

    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');

    if (!this.canManageDocument(jwtRole, jwtUserId, doc.uploaded_by)) {
      throw new ForbiddenException('You do not have permission to edit this document');
    }

    // Non-admin internal users can only edit documents in their own tenant
    if (jwtRole !== 'ADMIN' && doc.tenant_id !== jwtTenantId) {
      throw new ForbiddenException('You cannot edit documents from another tenant');
    }

    if (dto.department && !DOCUMENT_DEPARTMENTS.includes(dto.department as any)) {
      throw new BadRequestException('Invalid department');
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.filename && { filename: dto.filename }),
        ...(dto.department && { department: dto.department }),
      },
      include: {
        uploader: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
    });

    return { data: this.formatDocument(updated) };
  }

  // ── DELETE ──────────────────────────────────────────────────────────────────
  async delete(
    id: string,
    jwtTenantId: string,
    jwtRole: string,
    jwtUserId: string,
  ) {
    if (!this.isInternal(jwtRole)) {
      throw new ForbiddenException('Only internal users can delete documents');
    }

    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');

    if (!this.canManageDocument(jwtRole, jwtUserId, doc.uploaded_by)) {
      throw new ForbiddenException('You do not have permission to delete this document');
    }

    if (jwtRole !== 'ADMIN' && doc.tenant_id !== jwtTenantId) {
      throw new ForbiddenException('You cannot delete documents from another tenant');
    }

    const filePath = path.join(this.uploadsDir, doc.tenant_id, doc.storage_name);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      this.logger.warn(`Failed to delete file ${filePath}: ${err.message}`);
    }

    await this.prisma.document.delete({ where: { id } });
    return { data: { id }, message: 'Document deleted successfully' };
  }

  // ── DOWNLOAD ────────────────────────────────────────────────────────────────
  async findForDownload(
    id: string,
    jwtTenantId: string,
    jwtRole: string,
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        uploader: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
    });

    if (!doc) throw new NotFoundException('Document not found');

    if (jwtRole !== 'ADMIN' && doc.tenant_id !== jwtTenantId) {
      throw new ForbiddenException('You cannot access documents from another tenant');
    }

    const filePath = path.join(this.uploadsDir, doc.tenant_id, doc.storage_name);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    // Verify the resolved path is inside uploads dir (path traversal protection)
    const resolvedPath = fs.realpathSync(filePath);
    const resolvedUploadsDir = fs.realpathSync(this.uploadsDir);
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      throw new ForbiddenException('Invalid file path');
    }

    // Increment download count
    await this.prisma.document.update({
      where: { id },
      data: { download_count: { increment: 1 } },
    });

    return {
      filePath: resolvedPath,
      filename: doc.filename,
      mimeType: doc.mime_type || 'application/octet-stream',
      document: this.formatDocument(doc),
    };
  }

  // ── FORMATTER ───────────────────────────────────────────────────────────────
  private formatDocument(doc: any) {
    return {
      id: doc.id,
      tenant_id: doc.tenant_id,
      department: doc.department,
      filename: doc.filename,
      mime_type: doc.mime_type,
      size_bytes: doc.size_bytes,
      download_count: doc.download_count,
      uploaded_by: doc.uploaded_by,
      uploader_name: doc.uploader
        ? `${doc.uploader.first_name ?? ''} ${doc.uploader.last_name ?? ''}`.trim() || doc.uploader.email
        : undefined,
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString(),
    };
  }
}
