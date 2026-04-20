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
import { DeliveryService } from './delivery.service';
import {
  CreateDeliveryFeatureDto,
  UpdateDeliveryFeatureDto,
  DeliveryFeatureResponseDto,
} from './dto/delivery.dto';

@ApiTags('Delivery')
@ApiCookieAuth('access_token')
@Controller('delivery')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(private deliveryService: DeliveryService) {}

  @Get('features')
  @ApiOperation({ summary: 'List delivery features' })
  @ApiResponse({ status: 200, type: [DeliveryFeatureResponseDto] })
  findAll() {
    return this.deliveryService.findAll();
  }

  @Post('features')
  @ApiOperation({ summary: 'Create delivery feature' })
  @ApiBody({ type: CreateDeliveryFeatureDto })
  @ApiResponse({ status: 201, type: DeliveryFeatureResponseDto })
  create(@Body() dto: CreateDeliveryFeatureDto) {
    return this.deliveryService.create(dto);
  }

  @Patch('features/:id')
  @ApiOperation({ summary: 'Update delivery feature' })
  @ApiParam({ name: 'id', example: 'dlv_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiBody({ type: UpdateDeliveryFeatureDto })
  @ApiResponse({ status: 200, type: DeliveryFeatureResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateDeliveryFeatureDto) {
    return this.deliveryService.update(id, dto);
  }

  @Delete('features/:id')
  @ApiOperation({ summary: 'Delete delivery feature' })
  @ApiParam({ name: 'id', example: 'dlv_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@Param('id') id: string) {
    return this.deliveryService.remove(id);
  }
}
