import { IsString, IsOptional, IsEnum, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TicketCategory {
  BUG = 'BUG',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  SUPPORT = 'SUPPORT',
  BILLING = 'BILLING',
  QUESTION = 'QUESTION',
  INCIDENT = 'INCIDENT',
  TASK = 'TASK',
}

export class CreateTicketDto {
  @ApiProperty({ example: 'SSO login broken after Azure AD certificate renewal' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Full description text...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TicketPriority, example: TicketPriority.HIGH })
  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @ApiProperty({ enum: TicketCategory, example: TicketCategory.INCIDENT })
  @IsEnum(TicketCategory)
  category: TicketCategory;

  @ApiPropertyOptional({ example: ['sso', 'azure-ad', 'saml'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'usr-002' })
  @IsOptional()
  @IsString()
  assignee_id?: string;

  @ApiPropertyOptional({ example: ['att-001'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachment_ids?: string[];

  @ApiPropertyOptional({ example: 'UAT' })
  @IsOptional()
  @IsString()
  environment?: string;

  @ApiPropertyOptional({ example: '406f6000-2159-47cd-a1b1-46b2b8005784' })
  @IsOptional()
  @IsString()
  project_id?: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
