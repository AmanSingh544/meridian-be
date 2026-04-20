import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TicketTransitionDto {
  @ApiProperty({
    description: 'Target status for the transition',
    example: 'IN_PROGRESS',
  })
  @IsString()
  to_status: string;

  @ApiPropertyOptional({
    description: 'Optional reason or note for the transition (especially for reopens)',
    example: 'Customer confirmed the fix works',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
