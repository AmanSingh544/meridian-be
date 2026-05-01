import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import {
  ListDocumentsQueryDto,
  CreateDocumentBodyDto,
  UpdateDocumentDto,
  DocumentListResponseDto,
  DocumentResponseDto,
  DocumentStatsDto,
} from './dto/document.dto';

@ApiTags('Documents')
@ApiCookieAuth('access_token')
@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);
  constructor(private documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List documents for a tenant' })
  @ApiResponse({ status: 200, type: DocumentListResponseDto })
  findAll(
    @Query() query: ListDocumentsQueryDto,
    @CurrentUser('tenantId') jwtTenantId: string,
    @CurrentUser('role') jwtRole: string,
  ) {
    return this.documentsService.findAll(query, jwtTenantId, jwtRole);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get document library stats' })
  @ApiResponse({ status: 200, type: DocumentStatsDto })
  getStats(
    @Query('tenant_id') tenantId: string | undefined,
    @CurrentUser('tenantId') jwtTenantId: string,
    @CurrentUser('role') jwtRole: string,
  ) {
    return this.documentsService.getStats(tenantId, jwtTenantId, jwtRole);
  }

  @Post()
  @ApiOperation({ summary: 'Upload a new document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Document file + metadata',
    type: CreateDocumentBodyDto,
  })
  @ApiResponse({ status: 201, type: DocumentResponseDto })
  @UseInterceptors(FileInterceptor('file'))
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateDocumentBodyDto,
    @CurrentUser('tenantId') jwtTenantId: string,
    @CurrentUser('role') jwtRole: string,
    @CurrentUser('userId') jwtUserId: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.documentsService.create(file, body, jwtTenantId, jwtRole, jwtUserId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update document metadata' })
  @ApiResponse({ status: 200, type: DocumentResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser('tenantId') jwtTenantId: string,
    @CurrentUser('role') jwtRole: string,
    @CurrentUser('userId') jwtUserId: string,
  ) {
    return this.documentsService.update(id, dto, jwtTenantId, jwtRole, jwtUserId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 200 })
  delete(
    @Param('id') id: string,
    @CurrentUser('tenantId') jwtTenantId: string,
    @CurrentUser('role') jwtRole: string,
    @CurrentUser('userId') jwtUserId: string,
  ) {
    return this.documentsService.delete(id, jwtTenantId, jwtRole, jwtUserId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a document' })
  async download(
    @Param('id') id: string,
    @CurrentUser('tenantId') jwtTenantId: string,
    @CurrentUser('role') jwtRole: string,
    @Res() res: Response,
  ) {
    try {
      const { filePath, filename, mimeType } =
        await this.documentsService.findForDownload(id, jwtTenantId, jwtRole);

      res.setHeader('Content-Type', mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(filename)}"`,
      );

      const stream = createReadStream(filePath);
      stream.on('error', (err) => {
        this.logger.error(`Stream error for ${filePath}: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error streaming file' });
        }
      });
      stream.pipe(res);
    } catch (error) {
      this.logger.error(`Download failed for document ${id}: ${error.message}`);
      if (!res.headersSent) {
        throw error;
      }
    }
  }
}
