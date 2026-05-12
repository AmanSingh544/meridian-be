import { IsString, IsOptional, IsInt, IsBoolean, IsObject, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoutingRuleDto {
  @ApiProperty({ example: 'High Priority Route' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Route critical tickets to senior agents' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: [{ field: 'priority', operator: 'equals', value: 'CRITICAL' }] })
  @IsOptional()
  @IsArray()
  condition?: Record<string, any>[];

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  action?: Record<string, any>;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateRoutingRuleDto {
  @ApiPropertyOptional({ example: 'Updated Rule' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: [{ field: 'priority', operator: 'equals', value: 'CRITICAL' }] })
  @IsOptional()
  @IsArray()
  condition?: Record<string, any>[];

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  action?: Record<string, any>;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class RoutingRuleResponseDto {
  @ApiProperty({ example: 'rr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'High Priority Route' })
  name: string;

  @ApiProperty({ example: [{ field: 'priority', operator: 'equals', value: 'CRITICAL' }] })
  condition: Record<string, any>[];

  @ApiProperty({ example: {} })
  action: Record<string, any>;

  @ApiProperty({ example: 0 })
  priority: number;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  updated_at: string;
}
