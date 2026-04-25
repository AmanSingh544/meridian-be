import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, TicketCategory } from './create-ticket.dto';

export class UpdateTicketDto {
  @ApiPropertyOptional({ description: 'Updated ticket title', example: 'Updated title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Updated description', example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TicketPriority, example: TicketPriority.HIGH })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({ enum: TicketCategory, example: TicketCategory.BUG })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @ApiPropertyOptional({ example: ['sso', 'updated-tag'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Reassign ticket to a different user', example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02' })
  @IsOptional()
  @IsString()
  assignee_id?: string;

  @ApiPropertyOptional({ description: 'Alias — frontend sends assignedTo which interceptor converts to assigned_to' })
  @IsOptional()
  @IsString()
  assigned_to?: string;
}
