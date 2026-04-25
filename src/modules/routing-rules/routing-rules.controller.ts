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
import { RoutingRulesService } from './routing-rules.service';
import { CreateRoutingRuleDto, UpdateRoutingRuleDto, RoutingRuleResponseDto } from './dto/routing-rule.dto';

@ApiTags('Routing Rules')
@ApiCookieAuth('access_token')
@Controller('routing-rules')
@UseGuards(JwtAuthGuard)
export class RoutingRulesController {
  constructor(private routingRulesService: RoutingRulesService) {}

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
  create(@Query('tenant_id') tenantId: string, @Body() dto: CreateRoutingRuleDto) {
    return this.routingRulesService.create(tenantId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a routing rule' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: UpdateRoutingRuleDto })
  @ApiResponse({ status: 200, type: RoutingRuleResponseDto })
  update(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: UpdateRoutingRuleDto,
  ) {
    return this.routingRulesService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a routing rule' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  remove(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.routingRulesService.remove(id, tenantId);
  }
}
