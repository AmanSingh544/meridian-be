import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard.dto';

@ApiTags('Dashboard')
@ApiCookieAuth('access_token')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get dashboard KPIs for a tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: DashboardResponseDto })
  getKpis(@Query('tenant_id') tenantId: string) {
    return this.dashboardService.getKpis(tenantId);
  }

  @Get('agent-stats')
  @ApiOperation({ summary: 'Get per-agent workload stats' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  getAgentStats(@Query('tenant_id') tenantId: string) {
    return this.dashboardService.getAgentStats(tenantId);
  }
}
