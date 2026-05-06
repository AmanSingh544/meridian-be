import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
  Logger,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AttachmentsService } from './attachments.service';
import {
  CreateAttachmentDto,
  PresignUploadDto,
  ConfirmUploadDto,
  AttachmentResponseDto,
  PresignedUploadResponseDto,
} from './dto/attachment.dto';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'attachments');

const ALLOWED_PREVIEW_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf'];

@ApiTags('Attachments')
@ApiCookieAuth('access_token')
@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  private readonly logger = new Logger(AttachmentsController.name);
  constructor(private attachmentsService: AttachmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload an attachment file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'Attachment file + metadata', type: CreateAttachmentDto })
  @ApiResponse({ status: 201, type: AttachmentResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          // tenant_id is injected by middleware/guard into req.user normally,
          // but for diskStorage we use a fallback: resolve tenant from query/body
          const tenantId =
            (req as any).user?.tenantId ??
            (req.query?.tenant_id as string) ??
            'unknown';
          // project_id passed as query param so it's available before file parsing
          const projectId = /^[a-zA-Z0-9-_]+$/.test((req.query?.project_id as string) ?? '')
            ? (req.query.project_id as string)
            : 'general';
          const dest = path.join(UPLOADS_DIR, tenantId, projectId);
          fs.mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname) || '';
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateAttachmentDto,
    @CurrentUser('tenantId') jwtTenantId: string,
    @CurrentUser('userId') userId: string,
    @Query('tenant_id') queryTenantId?: string,
    @Query('project_id') queryProjectId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.attachmentsService.create({
      file,
      tenant_id: jwtTenantId ?? queryTenantId,
      uploaded_by: userId,
      ticket_id: dto.ticket_id,
      project_id: dto.project_id ?? queryProjectId,
    });
  }

  @Post('presign')
  @ApiOperation({ summary: 'Get a presigned URL for direct browser upload' })
  @ApiBody({ type: PresignUploadDto })
  @ApiResponse({ status: 200, type: PresignedUploadResponseDto })
  presign(@Body() dto: PresignUploadDto) {
    return this.attachmentsService.presign(dto);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm a completed presigned upload and persist the record' })
  @ApiBody({ type: ConfirmUploadDto })
  @ApiResponse({ status: 200, type: AttachmentResponseDto })
  confirm(
    @Body() dto: ConfirmUploadDto,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.attachmentsService.confirm({ ...dto, tenant_id: tenantId });
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download an attachment' })
  async download(
    @Param('id') id: string,
    @CurrentUser('tenantId') jwtTenantId: string,
    @CurrentUser('role') jwtRole: string,
    @CurrentUser('userId') jwtUserId: string,
    @Res() res: Response,
  ) {
    try {
      const { filePath, filename, mimeType } =
        await this.attachmentsService.findForDownload(id, jwtTenantId, jwtRole, jwtUserId);

      res.setHeader('Content-Type', mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );

      const stream = fs.createReadStream(filePath);
      stream.on('error', (err) => {
        this.logger.error(`Stream error for ${filePath}: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error streaming file' });
        }
      });
      stream.pipe(res);
    } catch (error) {
      this.logger.error(`Download failed for attachment ${id}: ${(error as Error).message}`);
      if (!res.headersSent) {
        throw error;
      }
    }
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Preview an attachment (images and PDFs only)' })
  async preview(
    @Param('id') id: string,
    @CurrentUser('tenantId') jwtTenantId: string,
    @CurrentUser('role') jwtRole: string,
    @CurrentUser('userId') jwtUserId: string,
    @Res() res: Response,
  ) {
    try {
      const { filePath, filename, rawFilename, mimeType } =
        await this.attachmentsService.findForDownload(id, jwtTenantId, jwtRole, jwtUserId);

      const ext = path.extname(rawFilename).toLowerCase();
      if (
        !ALLOWED_PREVIEW_EXTENSIONS.includes(ext) ||
        !(mimeType.startsWith('image/') || mimeType === 'application/pdf')
      ) {
        throw new UnsupportedMediaTypeException('Preview only available for images and PDFs');
      }

      res.setHeader('Content-Type', mimeType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${filename}"`,
      );

      const stream = fs.createReadStream(filePath);
      stream.on('error', (err) => {
        this.logger.error(`Stream error for preview ${filePath}: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error streaming file' });
        }
      });
      stream.pipe(res);
    } catch (error) {
      this.logger.error(`Preview failed for attachment ${id}: ${(error as Error).message}`);
      if (!res.headersSent) {
        throw error;
      }
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attachment' })
  @ApiResponse({ status: 200 })
  async delete(
    @Param('id') id: string,
    @CurrentUser('tenantId') jwtTenantId: string,
    @CurrentUser('role') jwtRole: string,
    @CurrentUser('userId') jwtUserId: string,
  ) {
    return this.attachmentsService.delete(id, jwtTenantId, jwtRole, jwtUserId);
  }
}
