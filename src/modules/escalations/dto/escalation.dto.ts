import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EscalationAssignDto {
  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsString()
  agent_id: string;
}

export class EscalationResolveDto {
  @ApiPropertyOptional({ example: 'Resolved by reassigning to senior agent.' })
  @IsOptional()
  @IsString()
  resolution?: string;
}

export class EscalationResponseDto {
  @ApiProperty({ example: 'esc_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'tkt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  ticket_id: string;

  @ApiProperty({ example: 'SLA breach imminent' })
  reason: string;

  @ApiProperty({ example: 'open' })
  status: string;

  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M', nullable: true })
  escalated_to: string | null;

  @ApiProperty({ example: '2026-04-16T10:00:00Z' })
  created_at: string;
}

export class EscalationAgentDto {
  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'Priya Sharma' })
  display_name: string;

  @ApiProperty({ example: 5 })
  current_load: number;
}
