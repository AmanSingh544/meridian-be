import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDeliveryFeatureDto {
  @ApiProperty({ example: 'Dark Mode Support' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Add dark mode across the portal' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'backlog' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'high' })
  @IsOptional()
  @IsString()
  priority?: string;
}

export class UpdateDeliveryFeatureDto {
  @ApiPropertyOptional({ example: 'Dark Mode Support v2' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'in_progress' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'medium' })
  @IsOptional()
  @IsString()
  priority?: string;
}

export class DeliveryFeatureResponseDto {
  @ApiProperty({ example: 'dlv_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'Dark Mode Support' })
  title: string;

  @ApiProperty({ example: 'Add dark mode across the portal', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'in_progress' })
  status: string;

  @ApiProperty({ example: 'high' })
  priority: string;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  updated_at: string;
}
