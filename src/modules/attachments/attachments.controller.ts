import { Controller, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiCookieAuth,
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

@ApiTags('Attachments')
@ApiCookieAuth('access_token')
@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private attachmentsService: AttachmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Register attachment metadata (direct/local upload flow)' })
  @ApiQuery({ name: 'tenant_id', required: false, description: 'Fallback — tenant is normally taken from JWT' })
  @ApiBody({ type: CreateAttachmentDto })
  @ApiResponse({ status: 201, type: AttachmentResponseDto })
  create(
    @Body() dto: CreateAttachmentDto,
    @CurrentUser('tenantId') jwtTenantId: string,
    @CurrentUser('userId') userId: string,
    @Query('tenant_id') queryTenantId?: string,
  ) {
    return this.attachmentsService.create({
      ...dto,
      tenant_id: jwtTenantId ?? queryTenantId,
      uploaded_by: userId,
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
}
