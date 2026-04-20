import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, TicketCategory } from './create-ticket.dto';

export class UpdateTicketDto {
  @ApiPropertyOptional({
    description: 'Updated ticket title',
    example: 'Updated title',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated description',
    example: 'Updated description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated priority',
    enum: TicketPriority,
    example: TicketPriority.HIGH,
  })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    description: 'Updated category',
    enum: TicketCategory,
    example: TicketCategory.BUG,
  })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @ApiPropertyOptional({
    description: 'Updated tags',
    example: ['sso', 'updated-tag'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Reassign ticket to a different user',
    example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M',
  })
  @IsOptional()
  @IsString()
  assigned_to?: string;
}
