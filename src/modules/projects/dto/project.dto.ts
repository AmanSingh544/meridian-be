import { IsString, IsOptional, IsObject, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'Acme Platform Migration' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Full migration of legacy systems...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Includes data migration, excludes branding work' })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsString()
  target_date?: string;

  @ApiPropertyOptional({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsOptional()
  @IsString()
  client_id?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Acme Platform Migration v2' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'completed' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Includes data migration, excludes branding work' })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsString()
  target_date?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ProjectResponseDto {
  @ApiProperty({ example: 'prj_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'Acme Platform Migration' })
  name: string;

  @ApiProperty({ example: 'Full migration of legacy systems...', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  tenant_id: string;

  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M', nullable: true })
  client_id: string | null;

  @ApiProperty({ example: 85, nullable: true })
  health_score: number | null;

  @ApiProperty({ example: {} })
  metadata: Record<string, any>;

  @ApiProperty({ example: '2026-01-10T09:00:00Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-10T14:30:00Z' })
  updated_at: string;
}
