import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
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
import { SlaService } from './sla.service';
import { CreateSlaPolicyDto, UpdateSlaPolicyDto, SlaPolicyResponseDto } from './dto/sla.dto';

@ApiTags('SLA Policies')
@ApiCookieAuth('access_token')
@Controller('sla')
@UseGuards(JwtAuthGuard)
export class SlaController {
  constructor(private slaService: SlaService) {}

  @Get('policies')
  @ApiOperation({ summary: 'List SLA policies for a tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: [SlaPolicyResponseDto] })
  findAll(@Query('tenant_id') tenantId: string) {
    return this.slaService.findAll(tenantId);
  }

  @Get('policies/:id')
  @ApiOperation({ summary: 'Get a single SLA policy' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: SlaPolicyResponseDto })
  findOne(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.slaService.findOne(id, tenantId);
  }

  @Post('policies')
  @ApiOperation({ summary: 'Create an SLA policy' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: CreateSlaPolicyDto })
  @ApiResponse({ status: 201, type: SlaPolicyResponseDto })
  create(@Query('tenant_id') tenantId: string, @Body() dto: CreateSlaPolicyDto) {
    return this.slaService.create(tenantId, dto as any);
  }

  @Patch('policies/:id')
  @ApiOperation({ summary: 'Update an SLA policy' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: UpdateSlaPolicyDto })
  @ApiResponse({ status: 200, type: SlaPolicyResponseDto })
  update(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: UpdateSlaPolicyDto,
  ) {
    return this.slaService.update(id, tenantId, dto);
  }

  @Delete('policies/:id')
  @ApiOperation({ summary: 'Delete an SLA policy' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  remove(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.slaService.remove(id, tenantId);
  }

  @Post('tickets/:ticketId/assign')
  @ApiOperation({ summary: 'Assign an SLA policy to a ticket (computes deadline)' })
  @ApiParam({ name: 'ticketId' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  assignToTicket(
    @Param('ticketId') ticketId: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: { policy_id: string },
  ) {
    return this.slaService.assignToTicket(ticketId, tenantId, dto.policy_id);
  }
}
