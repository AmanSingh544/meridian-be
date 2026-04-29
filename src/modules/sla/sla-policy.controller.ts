import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { SlaService } from './sla.service';

@ApiTags('SLA Policies')
@ApiCookieAuth('access_token')
@Controller('sla-policy')
@UseGuards(JwtAuthGuard)
export class SlaPolicyController {
  constructor(private slaService: SlaService) {}

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
  upsertGlobalPolicy(@CurrentUser('tenantId') tenantId: string, @Body() dto: any) {
    return this.slaService.upsertGlobalPolicy(tenantId, dto);
  }

  @Post('check-thresholds')
  @ApiOperation({ summary: 'Check SLA thresholds for all open tickets — triggers auto-escalation and admin notifications' })
  @ApiResponse({ status: 200 })
  checkThresholds(@CurrentUser('tenantId') tenantId: string) {
    return this.slaService.checkSlaThresholds(tenantId);
  }
}
