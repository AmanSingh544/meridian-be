import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PermissionGuard } from '../../shared/guards/permission.guard';
import { RequirePermission } from '../../shared/decorators/require-permission.decorator';
import { FeedbackService } from './feedback.service';

@ApiTags('Feedback')
@ApiCookieAuth('access_token')
@Controller('feedback')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('REPORT_VIEW')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'CSAT/NPS KPI summary' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  kpis(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.feedbackService.kpis(tenantId, period);
  }

  @Get('trends')
  @ApiOperation({ summary: 'CSAT & NPS trends over time' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  trends(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.feedbackService.trends(tenantId, period);
  }

  @Get('nps-breakdown')
  @ApiOperation({ summary: 'NPS breakdown (promoters/passives/detractors)' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  npsBreakdown(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.feedbackService.npsBreakdown(tenantId, period);
  }

  @Get('themes')
  @ApiOperation({ summary: 'Top feedback themes' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  themes(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.feedbackService.themes(tenantId, period);
  }
}
