import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { SlaService } from './sla.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@ApiTags('SLA Policies')
@ApiCookieAuth('access_token')
@Controller('sla-policy')
@UseGuards(JwtAuthGuard)
export class SlaPolicyController {
  constructor(
    private slaService: SlaService,
    private auditLogsService: AuditLogsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the global default SLA policy for the current tenant' })
  @ApiResponse({ status: 200 })
  getGlobalPolicy(@CurrentUser('tenantId') tenantId: string) {
    return this.slaService.getGlobalPolicy(tenantId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update the global default SLA policy for the current tenant' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiResponse({ status: 200 })
  async upsertGlobalPolicy(@CurrentUser('tenantId') tenantId: string, @Body() dto: any, @CurrentUser('userId') userId: string) {
    const result = await this.slaService.upsertGlobalPolicy(tenantId, dto);
    await this.auditLogsService.create({
      tenant_id: tenantId,
      user_id: userId,
      action: 'UPDATE',
      resource_type: 'SLA_POLICY',
      changes: dto,
    });
    return result;
  }

  @Post('check-thresholds')
  @ApiOperation({ summary: 'Check SLA thresholds for all open tickets — triggers auto-escalation and admin notifications' })
  @ApiResponse({ status: 200 })
  checkThresholds(@CurrentUser('tenantId') tenantId: string) {
    return this.slaService.checkSlaThresholds(tenantId);
  }
}
