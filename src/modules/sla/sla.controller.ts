import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
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
  @ApiOperation({ summary: 'List SLA policies' })
  @ApiResponse({ status: 200, type: [SlaPolicyResponseDto] })
  findAll() {
    return this.slaService.findAll();
  }

  @Post('policies')
  @ApiOperation({ summary: 'Create SLA policy' })
  @ApiBody({ type: CreateSlaPolicyDto })
  @ApiResponse({ status: 201, type: SlaPolicyResponseDto })
  create(@Body() dto: CreateSlaPolicyDto) {
    return this.slaService.create(dto);
  }

  @Patch('policies/:id')
  @ApiOperation({ summary: 'Update SLA policy' })
  @ApiParam({ name: 'id', example: 'sla_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiBody({ type: UpdateSlaPolicyDto })
  @ApiResponse({ status: 200, type: SlaPolicyResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateSlaPolicyDto) {
    return this.slaService.update(id, dto);
  }

  @Delete('policies/:id')
  @ApiOperation({ summary: 'Delete SLA policy' })
  @ApiParam({ name: 'id', example: 'sla_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@Param('id') id: string) {
    return this.slaService.remove(id);
  }
}
