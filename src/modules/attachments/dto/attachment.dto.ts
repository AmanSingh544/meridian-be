import { IsString, IsOptional, IsObject, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAttachmentDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'File to upload' })
  file: any;

  @ApiPropertyOptional({ example: 'saml_error_log.txt' })
  @IsOptional()
  @IsString()
  file_name?: string;

  @ApiPropertyOptional({ example: 'text/plain' })
  @IsOptional()
  @IsString()
  file_type?: string;

  @ApiPropertyOptional({ example: 'tkt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsOptional()
  @IsString()
  ticket_id?: string;

  @ApiPropertyOptional({ example: 'proj_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsOptional()
  @Matches(/^[a-zA-Z0-9-_]+$/)
  project_id?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class PresignUploadDto {
  @ApiProperty({ example: 'screenshot.png' })
  @IsString()
  file_name: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  mime_type: string;
}

export class ConfirmUploadDto {
  @ApiProperty({ example: 'uploads/abc123/screenshot.png' })
  @IsString()
  file_key: string;

  @ApiPropertyOptional({ example: 'tkt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsOptional()
  @IsString()
  ticket_id?: string;
}

export class AttachmentResponseDto {
  @ApiProperty({ example: 'att_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'saml_error_log.txt' })
  file_name: string;

  @ApiProperty({ example: 'text/plain' })
  file_type: string;

  @ApiProperty({ example: 'tenant_123/general/abc.txt' })
  file_path: string;

  @ApiProperty({ example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  tenant_id: string;

  @ApiPropertyOptional({ example: 'tkt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  ticket_id?: string;

  @ApiPropertyOptional({ example: 14200 })
  size_bytes?: number;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  created_at: string;
}

export class PresignedUploadResponseDto {
  @ApiProperty({ example: 'https://storage.googleapis.com/bucket/...' })
  upload_url: string;

  @ApiProperty({ example: 'uploads/abc123/screenshot.png' })
  file_key: string;

  @ApiProperty({ example: '2026-04-16T10:15:00Z' })
  expires_at: string;
}
