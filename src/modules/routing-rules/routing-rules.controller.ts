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
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RoutingRulesService } from './routing-rules.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateRoutingRuleDto, UpdateRoutingRuleDto, RoutingRuleResponseDto } from './dto/routing-rule.dto';

@ApiTags('Routing Rules')
@ApiCookieAuth('access_token')
@Controller('routing-rules')
@UseGuards(JwtAuthGuard)
export class RoutingRulesController {
  constructor(
    private routingRulesService: RoutingRulesService,
    private auditLogsService: AuditLogsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List routing rules for a tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: [RoutingRuleResponseDto] })
  findAll(@Query('tenant_id') tenantId: string) {
    return this.routingRulesService.findAll(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a routing rule' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: CreateRoutingRuleDto })
  @ApiResponse({ status: 201, type: RoutingRuleResponseDto })
  async create(@Query('tenant_id') tenantId: string, @Body() dto: CreateRoutingRuleDto, @CurrentUser('userId') userId: string) {
    const result = await this.routingRulesService.create(tenantId, dto);
    await this.auditLogsService.create({
      tenant_id: tenantId,
      user_id: userId,
      action: 'CREATE',
      resource_type: 'ROUTING_RULE',
      resource_id: result.data?.id,
    });
    return result;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a routing rule' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: UpdateRoutingRuleDto })
  @ApiResponse({ status: 200, type: RoutingRuleResponseDto })
  async update(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: UpdateRoutingRuleDto,
    @CurrentUser('userId') userId: string,
  ) {
    const result = await this.routingRulesService.update(id, tenantId, dto);
    await this.auditLogsService.create({
      tenant_id: tenantId,
      user_id: userId,
      action: 'UPDATE',
      resource_type: 'ROUTING_RULE',
      resource_id: id,
      changes: dto,
    });
    return result;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a routing rule' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  async remove(@Param('id') id: string, @Query('tenant_id') tenantId: string, @CurrentUser('userId') userId: string) {
    const result = await this.routingRulesService.remove(id, tenantId);
    await this.auditLogsService.create({
      tenant_id: tenantId,
      user_id: userId,
      action: 'DELETE',
      resource_type: 'ROUTING_RULE',
      resource_id: id,
    });
    return result;
  }
}
