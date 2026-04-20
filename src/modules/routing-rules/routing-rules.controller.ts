import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
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
  @ApiOperation({ summary: 'List routing rules' })
  @ApiResponse({ status: 200, type: [RoutingRuleResponseDto] })
  findAll() {
    return this.routingRulesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create routing rule' })
  @ApiBody({ type: CreateRoutingRuleDto })
  @ApiResponse({ status: 201, type: RoutingRuleResponseDto })
  create(@Body() dto: CreateRoutingRuleDto) {
    return this.routingRulesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update routing rule' })
  @ApiParam({ name: 'id', example: 'rr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiBody({ type: UpdateRoutingRuleDto })
  @ApiResponse({ status: 200, type: RoutingRuleResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateRoutingRuleDto) {
    return this.routingRulesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete routing rule' })
  @ApiParam({ name: 'id', example: 'rr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@Param('id') id: string) {
    return this.routingRulesService.remove(id);
  }
}
