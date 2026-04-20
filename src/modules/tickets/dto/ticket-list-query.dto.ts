import { IsOptional, IsString, IsNumberString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class TicketListQueryDto {
  @ApiPropertyOptional({
    description: 'Tenant ID (injected automatically by the frontend)',
    example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by status. Send multiple times for OR filtering.',
    example: 'OPEN',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by priority',
    example: 'HIGH',
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({
    description: 'Filter by category',
    example: 'INCIDENT',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter by assignee user ID',
    example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @IsOptional()
  @IsString()
  assigned_to?: string;

  @ApiPropertyOptional({
    description: 'Filter by creator user ID',
    example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @IsOptional()
  @IsString()
  created_by?: string;

  @ApiPropertyOptional({
    description: 'Filter by project ID',
    example: 'prj_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @IsOptional()
  @IsString()
  project_id?: string;

  @ApiPropertyOptional({
    description: 'Full-text search across title, ticket_number, and tags',
    example: 'SSO azure',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter tickets created after this date (ISO 8601)',
    example: '2026-04-01T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Filter tickets created before this date (ISO 8601)',
    example: '2026-04-30T23:59:59Z',
  })
  @IsOptional()
  @IsString()
  date_to?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: '1',
    default: '1',
  })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: '25',
    default: '25',
  })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'updated_at',
    default: 'updated_at',
  })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SortOrder,
    example: SortOrder.DESC,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder;
}
