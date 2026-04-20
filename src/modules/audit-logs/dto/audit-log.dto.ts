import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogQueryDto {
  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  page?: string;

  @ApiPropertyOptional({ example: '20' })
  @IsOptional()
  page_size?: string;

  @ApiPropertyOptional({ example: 'ticket' })
  @IsOptional()
  @IsString()
  resource_type?: string;

  @ApiPropertyOptional({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsOptional()
  @IsString()
  user_id?: string;
}

export class AuditLogResponseDto {
  @ApiProperty({ example: 'aud_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  tenant_id: string;

  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M', nullable: true })
  user_id: string | null;

  @ApiProperty({ example: 'TICKET_UPDATED' })
  action: string;

  @ApiProperty({ example: 'ticket' })
  resource_type: string;

  @ApiProperty({ example: 'tkt_01HZX8K7YV7QNSQJQ5ZQFJ9K3M', nullable: true })
  resource_id: string | null;

  @ApiProperty({ example: {}, nullable: true })
  changes: Record<string, any> | null;

  @ApiProperty({ example: '192.168.1.1', nullable: true })
  ip_address: string | null;

  @ApiProperty({ example: '2026-04-16T07:45:00Z' })
  created_at: string;
}
