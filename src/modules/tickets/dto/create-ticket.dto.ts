import { IsString, IsOptional, IsEnum, IsArray, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
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
  @ApiProperty({
    description: 'Ticket title',
    example: 'SSO login broken after Azure AD certificate renewal',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Detailed description of the issue',
    example: 'Full description text...',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Ticket priority',
    enum: TicketPriority,
    example: TicketPriority.CRITICAL,
  })
  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @ApiProperty({
    description: 'Ticket category',
    enum: TicketCategory,
    example: TicketCategory.INCIDENT,
  })
  @IsEnum(TicketCategory)
  category: TicketCategory;

  @ApiProperty({
    description: 'Tags for categorization and search',
    example: ['sso', 'azure-ad', 'saml'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({
    description: 'Associated project ID',
    example: 'prj_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
    required: false,
  })
  @IsOptional()
  @IsString()
  project_id?: string;

  @ApiProperty({
    description: 'Attachment IDs to associate with the ticket (pre-uploaded via POST /attachments)',
    example: [1001, 1002],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  attachment_ids?: number[];
}
