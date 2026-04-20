import { ApiProperty } from '@nestjs/swagger';

export class OrganizationDto {
  @ApiProperty({ example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'acme-corp' })
  slug: string;

  @ApiProperty({ example: 'Acme Corp' })
  name: string;

  @ApiProperty({ example: 'premium' })
  plan: string;

  @ApiProperty({ example: 12 })
  user_count: number;

  @ApiProperty({ example: 47 })
  ticket_count: number;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  created_at: string;
}

export class PaginatedOrganizationResponseDto {
  @ApiProperty({ type: [OrganizationDto] })
  data: OrganizationDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  page_size: number;

  @ApiProperty({ example: 5 })
  total: number;

  @ApiProperty({ example: 1 })
  total_pages: number;
}

export class SingleOrganizationResponseDto {
  @ApiProperty({ type: OrganizationDto })
  data: OrganizationDto;
}
