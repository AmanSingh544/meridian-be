import {
  Controller, Get, Post, Body, Query, Param, UseGuards, Req, ParseIntPipe,
  DefaultValuePipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags, ApiOperation, ApiQuery, ApiCookieAuth, ApiBody, ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PermissionGuard } from '../../shared/guards/permission.guard';
import { RequirePermission } from '../../shared/decorators/require-permission.decorator';
import { FeedbackService } from './feedback.service';
import { CreateSurveyTokenDto, SubmitSurveyDto } from './dto/feedback.dto';

@ApiTags('Feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  // ─── Public survey endpoints (no auth) ─────────────────────────────────────

  @Get('validate')
  @ApiOperation({ summary: 'Validate a survey token (public)' })
  @ApiQuery({ name: 'token', required: true, description: 'UUID survey token' })
  validateToken(@Query('token') token: string) {
    return this.feedbackService.validateToken(token);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Submit CSAT survey (public, rate-limited to 5/min)' })
  @ApiBody({ type: SubmitSurveyDto })
  submitSurvey(@Body() dto: SubmitSurveyDto) {
    return this.feedbackService.submitSurvey(dto);
  }

  // ─── Internal authenticated endpoints ──────────────────────────────────────

  @Post('tokens')
  @ApiCookieAuth('access_token')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('REPORT_VIEW')
  @ApiOperation({ summary: 'Create a survey token/invite' })
  @ApiBody({ type: CreateSurveyTokenDto })
  createToken(@Req() req: any, @Body() dto: CreateSurveyTokenDto) {
    return this.feedbackService.createToken(req.user.tenant_id, req.user.id, dto);
  }

  @Get('tokens')
  @ApiCookieAuth('access_token')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('REPORT_VIEW')
  @ApiOperation({ summary: 'List survey tokens for a tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'page_size', required: false })
  listTokens(
    @Query('tenant_id') tenantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('page_size', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.feedbackService.listTokens(tenantId, page, pageSize);
  }

  @Get('responses')
  @ApiCookieAuth('access_token')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('REPORT_VIEW')
  @ApiOperation({ summary: 'List individual survey responses' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'page_size', required: false })
  listResponses(
    @Query('tenant_id') tenantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('page_size', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.feedbackService.listResponses(tenantId, page, pageSize);
  }

  @Get('kpis')
  @ApiCookieAuth('access_token')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('REPORT_VIEW')
  @ApiOperation({ summary: 'CSAT/NPS KPI summary' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  kpis(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.feedbackService.kpis(tenantId, period);
  }

  @Get('trends')
  @ApiCookieAuth('access_token')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('REPORT_VIEW')
  @ApiOperation({ summary: 'CSAT & NPS trends over time' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  trends(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.feedbackService.trends(tenantId, period);
  }

  @Get('nps-breakdown')
  @ApiCookieAuth('access_token')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('REPORT_VIEW')
  @ApiOperation({ summary: 'NPS breakdown (promoters/passives/detractors)' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  npsBreakdown(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.feedbackService.npsBreakdown(tenantId, period);
  }

  @Get('themes')
  @ApiCookieAuth('access_token')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('REPORT_VIEW')
  @ApiOperation({ summary: 'Top feedback themes' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  themes(@Query('tenant_id') tenantId: string, @Query('period') period?: string) {
    return this.feedbackService.themes(tenantId, period);
  }
}
