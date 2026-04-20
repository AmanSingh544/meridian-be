import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClassifyTextDto {
  @ApiProperty({ example: 'SSO login broken' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Users cannot log in via SSO' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class AISuggestionResponseDto {
  @ApiProperty({ example: 'sugg_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'classification' })
  type: string;

  @ApiProperty({ example: {} })
  suggestion: Record<string, any>;

  @ApiProperty({ example: 0.92 })
  confidence: number;
}

export class AIDigestResponseDto {
  @ApiProperty({ example: '3 tickets need attention' })
  summary: string;

  @ApiProperty({ example: [] })
  patterns: string[];

  @ApiProperty({ example: [] })
  gaps: string[];
}

export class AISearchQueryDto {
  @ApiProperty({ example: 'SSO configuration' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ example: 'kb' })
  @IsOptional()
  @IsString()
  scope?: string;
}

export class AIProjectHealthDto {
  @ApiProperty({ example: 85 })
  health_score: number;

  @ApiProperty({ example: 'Project is on track' })
  summary: string;
}

export class AITextClassificationResultDto {
  @ApiProperty({ example: 'INCIDENT' })
  category: string;

  @ApiProperty({ example: 'HIGH' })
  priority: string;
}
