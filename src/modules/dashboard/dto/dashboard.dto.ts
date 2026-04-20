import { ApiProperty } from '@nestjs/swagger';

export class DashboardKpiDto {
  @ApiProperty({ example: 47 })
  total: number;

  @ApiProperty({ example: 14 })
  open_tickets: number;

  @ApiProperty({ example: 3 })
  resolved_today: number;

  @ApiProperty({ example: '2d 4h' })
  avg_resolution_time: string;

  @ApiProperty({ example: 0.92 })
  sla_compliance_rate: number;

  @ApiProperty({ example: { LOW: 8, MEDIUM: 15, HIGH: 18, CRITICAL: 6 } })
  by_priority: Record<string, number>;

  @ApiProperty({ example: { OPEN: 12, ACKNOWLEDGED: 5, IN_PROGRESS: 18, RESOLVED: 8, CLOSED: 4 } })
  by_status: Record<string, number>;
}

export class DashboardResponseDto {
  @ApiProperty({ type: DashboardKpiDto })
  data: DashboardKpiDto;
}
