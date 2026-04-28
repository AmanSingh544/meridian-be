import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { EscalationsService } from './escalations.service';
import { EscalationAssignDto, EscalationResolveDto, EscalationResponseDto, EscalationAgentDto } from './dto/escalation.dto';

@ApiTags('Escalations')
@ApiCookieAuth('access_token')
@Controller('escalations')
@UseGuards(JwtAuthGuard)
export class EscalationsController {
  constructor(private escalationsService: EscalationsService) {}

  @Get('agents')
  @ApiOperation({ summary: 'List agents available for escalation assignment' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: [EscalationAgentDto] })
  getAgents(@Query('tenant_id') tenantId: string) {
    return this.escalationsService.getAgents(tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List escalations for a tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, type: [EscalationResponseDto] })
  findAll(
    @Query('tenant_id') tenantId: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    return this.escalationsService.findAll(tenantId, { status, page: parseInt(page), limit: parseInt(limit) });
  }

  @Post()
  @ApiOperation({ summary: 'Create an escalation' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 201, type: EscalationResponseDto })
  create(
    @Query('tenant_id') tenantId: string,
    @Body() dto: { ticket_id: string; reason: string; escalated_to?: string },
  ) {
    return this.escalationsService.create(tenantId, dto);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign escalation to an agent' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: EscalationAssignDto })
  @ApiResponse({ status: 200 })
  assign(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: EscalationAssignDto,
  ) {
    return this.escalationsService.assign(id, tenantId, (dto as any).agent_id);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an escalation' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: EscalationResolveDto })
  @ApiResponse({ status: 200 })
  resolve(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.escalationsService.resolve(id, tenantId);
  }
}
