import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyticsFiltersDto {
  @ApiProperty({ example: '2026-04-01T00:00:00Z' })
  @IsString()
  date_from: string;

  @ApiProperty({ example: '2026-04-30T23:59:59Z' })
  @IsString()
  date_to: string;

  @ApiPropertyOptional({ example: 'org_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsOptional()
  @IsString()
  organization_id?: string;

  @ApiPropertyOptional({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @IsOptional()
  @IsString()
  agent_id?: string;
}

export class TicketVolumeDataDto {
  @ApiProperty({ example: '2026-04-14' })
  date: string;

  @ApiProperty({ example: 4 })
  created: number;

  @ApiProperty({ example: 1 })
  resolved: number;

  @ApiProperty({ example: 0 })
  closed: number;
}

export class SLAComplianceDataDto {
  @ApiProperty({ example: 'Apr 2026' })
  period: string;

  @ApiProperty({ example: 0.93 })
  response_compliance: number;

  @ApiProperty({ example: 0.88 })
  resolution_compliance: number;

  @ApiProperty({ example: 47 })
  total_tickets: number;

  @ApiProperty({ example: 5 })
  breached_tickets: number;
}

export class ResolutionTrendDataDto {
  @ApiProperty({ example: 'Apr 2026' })
  period: string;

  @ApiProperty({ example: 28.5 })
  avg_resolution_hours: number;

  @ApiProperty({ example: 24.0 })
  median_resolution_hours: number;

  @ApiProperty({ example: 72.0 })
  p95_resolution_hours: number;
}

export class AgentPerformanceDataDto {
  @ApiProperty({ example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  agent_id: string;

  @ApiProperty({ example: 'Priya Sharma' })
  agent_name: string;

  @ApiProperty({ example: 12 })
  tickets_assigned: number;

  @ApiProperty({ example: 8 })
  tickets_resolved: number;

  @ApiProperty({ example: 18.5 })
  avg_resolution_hours: number;

  @ApiProperty({ example: 0.95 })
  sla_compliance: number;
}

export class MonthlyVolumeDataDto {
  @ApiProperty({ example: 'Apr 2026' })
  month: string;

  @ApiProperty({ example: 42 })
  created: number;

  @ApiProperty({ example: 38 })
  resolved: number;
}

export class CategoryBreakdownDataDto {
  @ApiProperty({ example: 'Technical' })
  category: string;

  @ApiProperty({ example: 25 })
  count: number;

  @ApiProperty({ example: 35.7 })
  percentage: number;
}

export class SeverityDistributionDataDto {
  @ApiProperty({ example: 'CRITICAL' })
  priority: string;

  @ApiProperty({ example: 6 })
  count: number;

  @ApiProperty({ example: 12.8 })
  percentage: number;
}

export class ResolutionBySeverityDataDto {
  @ApiProperty({ example: 'CRITICAL' })
  priority: string;

  @ApiProperty({ example: 4.5 })
  avg_hours: number;
}
