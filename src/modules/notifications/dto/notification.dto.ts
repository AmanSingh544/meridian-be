import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty({ example: 'notif_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  id: string;

  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  user_id: string;

  @ApiProperty({ example: 'ticket_status_changed' })
  type: string;

  @ApiProperty({ example: 'TKT-C001 status updated' })
  title: string;

  @ApiProperty({ example: 'Ticket has been updated to In Progress.', nullable: true })
  body: string | null;

  @ApiProperty({ example: false })
  is_read: boolean;

  @ApiProperty({ example: {}, nullable: true })
  data: Record<string, any> | null;

  @ApiProperty({ example: '2026-04-16T07:45:00Z' })
  created_at: string;
}
