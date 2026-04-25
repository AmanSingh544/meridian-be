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
import { DeliveryService } from './delivery.service';
import { CreateDeliveryFeatureDto, UpdateDeliveryFeatureDto, DeliveryFeatureResponseDto } from './dto/delivery.dto';

@ApiTags('Delivery')
@ApiCookieAuth('access_token')
@Controller('delivery')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(private deliveryService: DeliveryService) {}

  @Get('features')
  @ApiOperation({ summary: 'List delivery items for a tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, type: [DeliveryFeatureResponseDto] })
  findAll(
    @Query('tenant_id') tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('status') status?: string,
  ) {
    return this.deliveryService.findAll(tenantId, { page: parseInt(page), limit: parseInt(limit), status });
  }

  @Get('features/:id')
  @ApiOperation({ summary: 'Get a single delivery item' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: DeliveryFeatureResponseDto })
  findOne(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.deliveryService.findOne(id, tenantId);
  }

  @Post('features')
  @ApiOperation({ summary: 'Create a delivery item' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: CreateDeliveryFeatureDto })
  @ApiResponse({ status: 201, type: DeliveryFeatureResponseDto })
  create(@Query('tenant_id') tenantId: string, @Body() dto: CreateDeliveryFeatureDto) {
    return this.deliveryService.create(tenantId, dto);
  }

  @Patch('features/:id')
  @ApiOperation({ summary: 'Update a delivery item' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: UpdateDeliveryFeatureDto })
  @ApiResponse({ status: 200, type: DeliveryFeatureResponseDto })
  update(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: UpdateDeliveryFeatureDto,
  ) {
    return this.deliveryService.update(id, tenantId, dto);
  }

  @Delete('features/:id')
  @ApiOperation({ summary: 'Delete a delivery item' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  remove(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.deliveryService.remove(id, tenantId);
  }
}
