import { IsString, IsOptional, IsInt, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSlaPolicyDto {
  @ApiProperty({ example: 'Standard Support' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'MEDIUM' })
  @IsString()
  priority: string;

  @ApiProperty({ example: 60 })
  @IsInt()
  first_response_minutes: number;

  @ApiProperty({ example: 240 })
  @IsInt()
  resolution_minutes: number;

  @ApiPropertyOptional({ example: { start: '09:00', end: '17:00' } })
  @IsOptional()
  @IsObject()
  business_hours?: Record<string, any>;

  @ApiPropertyOptional({ example: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateSlaPolicyDto {
  @ApiPropertyOptional({ example: 'Premium Support' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  first_response_minutes?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  resolution_minutes?: number;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  business_hours?: Record<string, any>;

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class SlaPolicyResponseDto {
  @ApiProperty({ example: 'sla_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'Standard Support' })
  name: string;

  @ApiProperty({ example: 'MEDIUM' })
  priority: string;

  @ApiProperty({ example: 60 })
  first_response_minutes: number;

  @ApiProperty({ example: 240 })
  resolution_minutes: number;

  @ApiProperty({ example: {} })
  business_hours: Record<string, any>;

  @ApiProperty({ example: 'UTC' })
  timezone: string;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  created_at: string;
}
