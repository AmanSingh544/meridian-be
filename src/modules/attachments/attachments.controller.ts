import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
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
  @ApiOperation({ summary: 'Create attachment metadata' })
  @ApiBody({ type: CreateAttachmentDto })
  @ApiResponse({ status: 201, type: AttachmentResponseDto })
  create(@Body() dto: CreateAttachmentDto) {
    return this.attachmentsService.create(dto);
  }

  @Post('presign')
  @ApiOperation({ summary: 'Get presigned upload URL' })
  @ApiBody({ type: PresignUploadDto })
  @ApiResponse({ status: 200, type: PresignedUploadResponseDto })
  presign(@Body() dto: PresignUploadDto) {
    return this.attachmentsService.presign(dto);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm completed upload' })
  @ApiBody({ type: ConfirmUploadDto })
  @ApiResponse({ status: 200, type: AttachmentResponseDto })
  confirm(@Body() dto: ConfirmUploadDto) {
    return this.attachmentsService.confirm(dto);
  }
}
