import { IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkloadDto {
  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  max_capacity?: number;

  @ApiPropertyOptional({ example: 'busy' })
  @IsOptional()
  @IsString()
  availability?: string;
}

export class WorkloadResponseDto {
  @ApiProperty({ example: 'wl_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  user_id: string;

  @ApiProperty({ example: 5 })
  active_tickets: number;

  @ApiProperty({ example: 10 })
  max_capacity: number;

  @ApiProperty({ example: 'available' })
  availability: string;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  updated_at: string;
}
