import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDeliveryFeatureDto {
  @ApiProperty({ example: 'Dark Mode Support' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Add dark mode across the portal' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'BACKLOG' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'high' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ example: 'AI' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Q2 2026' })
  @IsOptional()
  @IsString()
  quarter?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_public?: boolean;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  upvotes?: number;
}

export class UpdateDeliveryFeatureDto {
  @ApiPropertyOptional({ example: 'Dark Mode Support v2' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'IN_PROGRESS' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'medium' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ example: 'AI' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Q2 2026' })
  @IsOptional()
  @IsString()
  quarter?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_public?: boolean;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  upvotes?: number;
}

export class DeliveryFeatureResponseDto {
  @ApiProperty({ example: 'dlv_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'Dark Mode Support' })
  title: string;

  @ApiProperty({ example: 'Add dark mode across the portal', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'IN_PROGRESS' })
  status: string;

  @ApiProperty({ example: 'high' })
  priority: string;

  @ApiProperty({ example: 'AI', nullable: true })
  category: string | null;

  @ApiProperty({ example: 'Q2 2026', nullable: true })
  quarter: string | null;

  @ApiProperty({ example: true })
  is_public: boolean;

  @ApiProperty({ example: 5 })
  upvotes: number;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  updated_at: string;
}
