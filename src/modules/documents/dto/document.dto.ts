import {
  IsString,
  IsOptional,
  IsInt,
  IsUUID,
  Min,
  Max,
  IsIn,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export const DOCUMENT_DEPARTMENTS = [
  'Delivery Team',
  'Integration Team',
  'Support Team',
  'Product Team',
  'Engineering',
  'Sales',
  'HR',
  'Finance',
  'Legal',
  'Marketing',
  'Operations',
  'General',
] as const;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'text/plain',
  'text/csv',
];

export const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024;

// ── Query DTO ───────────────────────────────────────────────────────────────
export class ListDocumentsQueryDto {
  @ApiPropertyOptional({ example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @ApiPropertyOptional({ example: 'Delivery Team' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'onboarding' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 20;

  @ApiPropertyOptional({ example: 'created_at' })
  @IsOptional()
  @IsString()
  sort_by?: string = 'created_at';

  @ApiPropertyOptional({ example: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'] as const)
  sort_order?: 'asc' | 'desc' = 'desc';
}

// ── Create / Update DTOs ────────────────────────────────────────────────────
export class CreateDocumentBodyDto {
  @ApiProperty({ example: 'Customer Onboarding Guide.pdf' })
  @IsString()
  filename: string;

  @ApiProperty({ example: 'Delivery Team', enum: DOCUMENT_DEPARTMENTS })
  @IsIn(DOCUMENT_DEPARTMENTS)
  department: string;

  @ApiPropertyOptional({ example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsOptional()
  @IsUUID()
  target_tenant_id?: string;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional({ example: 'Customer Onboarding Guide v2.pdf' })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({ example: 'Support Team', enum: DOCUMENT_DEPARTMENTS })
  @IsOptional()
  @IsIn(DOCUMENT_DEPARTMENTS)
  department?: string;
}

// ── Response DTOs ───────────────────────────────────────────────────────────
export class DocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenant_id: string;

  @ApiProperty()
  department: string;

  @ApiProperty()
  filename: string;

  @ApiProperty()
  mime_type: string | null;

  @ApiProperty()
  size_bytes: number;

  @ApiProperty()
  download_count: number;

  @ApiProperty()
  uploaded_by: string;

  @ApiProperty()
  created_at: string;

  @ApiProperty()
  updated_at: string;
}

export class DocumentListResponseDto {
  @ApiProperty({ type: [DocumentResponseDto] })
  data: DocumentResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  page_size: number;

  @ApiProperty()
  total_pages: number;
}

export class DocumentStatsDto {
  @ApiProperty()
  total_files: number;

  @ApiProperty()
  total_departments: number;

  @ApiProperty()
  total_downloads: number;
}
