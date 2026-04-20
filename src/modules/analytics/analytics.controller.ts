import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import {
  TicketVolumeDataDto,
  SLAComplianceDataDto,
  ResolutionTrendDataDto,
  AgentPerformanceDataDto,
  MonthlyVolumeDataDto,
  CategoryBreakdownDataDto,
  SeverityDistributionDataDto,
  ResolutionBySeverityDataDto,
} from './dto/analytics.dto';

@ApiTags('Analytics')
@ApiCookieAuth('access_token')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('ticket-volume')
  @ApiOperation({ summary: 'Ticket volume over time' })
  @ApiResponse({ status: 200, type: [TicketVolumeDataDto] })
  ticketVolume() { return this.analyticsService.ticketVolume(); }

  @Get('sla-compliance')
  @ApiOperation({ summary: 'SLA compliance metrics' })
  @ApiResponse({ status: 200, type: [SLAComplianceDataDto] })
  slaCompliance() { return this.analyticsService.slaCompliance(); }

  @Get('resolution-trends')
  @ApiOperation({ summary: 'Resolution trend metrics' })
  @ApiResponse({ status: 200, type: [ResolutionTrendDataDto] })
  resolutionTrends() { return this.analyticsService.resolutionTrends(); }

  @Get('agent-performance')
  @ApiOperation({ summary: 'Agent performance metrics' })
  @ApiResponse({ status: 200, type: [AgentPerformanceDataDto] })
  agentPerformance() { return this.analyticsService.agentPerformance(); }

  @Get('monthly-volume')
  @ApiOperation({ summary: 'Monthly ticket volume' })
  @ApiResponse({ status: 200, type: [MonthlyVolumeDataDto] })
  monthlyVolume() { return this.analyticsService.monthlyVolume(); }

  @Get('category-breakdown')
  @ApiOperation({ summary: 'Tickets by category' })
  @ApiResponse({ status: 200, type: [CategoryBreakdownDataDto] })
  categoryBreakdown() { return this.analyticsService.categoryBreakdown(); }

  @Get('severity-distribution')
  @ApiOperation({ summary: 'Tickets by severity/priority' })
  @ApiResponse({ status: 200, type: [SeverityDistributionDataDto] })
  severityDistribution() { return this.analyticsService.severityDistribution(); }

  @Get('resolution-by-severity')
  @ApiOperation({ summary: 'Resolution time by severity' })
  @ApiResponse({ status: 200, type: [ResolutionBySeverityDataDto] })
  resolutionBySeverity() { return this.analyticsService.resolutionBySeverity(); }
}
