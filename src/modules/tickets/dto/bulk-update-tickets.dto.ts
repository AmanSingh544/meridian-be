import { IsArray, IsOptional, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UpdateTicketDto } from './update-ticket.dto';

export class BulkUpdateTicketsDto {
  @ApiProperty({ description: 'Ticket IDs to update', example: ['uuid-1', 'uuid-2'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ticket_ids: string[];

  @ApiPropertyOptional({ description: 'Fields to apply to all selected tickets', type: UpdateTicketDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTicketDto)
  updates?: UpdateTicketDto;
}
