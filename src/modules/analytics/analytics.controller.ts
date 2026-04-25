import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

function periodToDays(period?: string): number {
  if (period === '7d')  return 7;
  if (period === '90d') return 90;
  return 30; // default: 30d
}

@ApiTags('Analytics')
@ApiCookieAuth('access_token')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('ticket-volume')
  @ApiOperation({ summary: 'Ticket volume over time (daily)' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  ticketVolume(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.analyticsService.ticketVolume(tenantId, periodToDays(period));
  }

  @Get('sla-compliance')
  @ApiOperation({ summary: 'SLA compliance rate' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  slaCompliance(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.analyticsService.slaCompliance(tenantId, periodToDays(period));
  }

  @Get('resolution-trends')
  @ApiOperation({ summary: 'Avg resolution time by week' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  resolutionTrends(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.analyticsService.resolutionTrends(tenantId, periodToDays(period));
  }

  @Get('agent-performance')
  @ApiOperation({ summary: 'Per-agent ticket resolution stats' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  agentPerformance(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.analyticsService.agentPerformance(tenantId, periodToDays(period));
  }

  @Get('monthly-volume')
  @ApiOperation({ summary: 'Monthly ticket volume' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  monthlyVolume(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.analyticsService.monthlyVolume(tenantId, periodToDays(period));
  }

  @Get('category-breakdown')
  @ApiOperation({ summary: 'Ticket count by category' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  categoryBreakdown(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.analyticsService.categoryBreakdown(tenantId, periodToDays(period));
  }

  @Get('severity-distribution')
  @ApiOperation({ summary: 'Ticket count by priority' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  severityDistribution(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.analyticsService.severityDistribution(tenantId, periodToDays(period));
  }

  @Get('resolution-by-severity')
  @ApiOperation({ summary: 'Avg resolution time by priority' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  resolutionBySeverity(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.analyticsService.resolutionBySeverity(tenantId, periodToDays(period));
  }
}
