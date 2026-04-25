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
import { RoadmapService } from './roadmap.service';
import { RoadmapFeatureResponseDto, SubmitFeatureRequestDto, VoteResponseDto } from './dto/roadmap.dto';

@ApiTags('Roadmap')
@ApiCookieAuth('access_token')
@Controller('roadmap')
@UseGuards(JwtAuthGuard)
export class RoadmapController {
  constructor(private roadmapService: RoadmapService) {}

  @Get()
  @ApiOperation({ summary: 'List roadmap features for a tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, type: [RoadmapFeatureResponseDto] })
  findAll(
    @Query('tenant_id') tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('status') status?: string,
  ) {
    return this.roadmapService.findAll(tenantId, { page: parseInt(page), limit: parseInt(limit), status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single roadmap feature' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: RoadmapFeatureResponseDto })
  findOne(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.roadmapService.findOne(id, tenantId);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Submit a feature request' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: SubmitFeatureRequestDto })
  @ApiResponse({ status: 201, type: RoadmapFeatureResponseDto })
  create(
    @Query('tenant_id') tenantId: string,
    @Body() dto: SubmitFeatureRequestDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.roadmapService.create(tenantId, dto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a roadmap feature' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: RoadmapFeatureResponseDto })
  update(@Param('id') id: string, @Query('tenant_id') tenantId: string, @Body() dto: any) {
    return this.roadmapService.update(id, tenantId, dto);
  }

  @Post('features/:id/vote')
  @ApiOperation({ summary: 'Vote for a feature' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: VoteResponseDto })
  vote(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.roadmapService.vote(id, tenantId);
  }

  @Delete('features/:id/vote')
  @ApiOperation({ summary: 'Remove vote from a feature' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: VoteResponseDto })
  unvote(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.roadmapService.unvote(id, tenantId);
  }
}
