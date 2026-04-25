import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
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
import { WorkloadsService } from './workloads.service';
import { UpdateWorkloadDto, WorkloadResponseDto } from './dto/workload.dto';

@ApiTags('Workloads')
@ApiCookieAuth('access_token')
@Controller('workloads')
@UseGuards(JwtAuthGuard)
export class WorkloadsController {
  constructor(private workloadsService: WorkloadsService) {}

  @Get('workload-summary')
  @ApiOperation({ summary: 'Get workload summary across all agents in a tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  getWorkloadSummary(@Query('tenant_id') tenantId: string) {
    return this.workloadsService.getWorkloadSummary(tenantId);
  }

  @Get('users/:id/workload')
  @ApiOperation({ summary: 'Get workload for a user' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: WorkloadResponseDto })
  getUserWorkload(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.workloadsService.getUserWorkload(id, tenantId);
  }

  @Patch('users/:id/workload')
  @ApiOperation({ summary: 'Update workload settings for a user' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: UpdateWorkloadDto })
  @ApiResponse({ status: 200, type: WorkloadResponseDto })
  updateUserWorkload(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: UpdateWorkloadDto,
    @CurrentUser('userId') actorId: string,
    @CurrentUser('role') actorRole: string,
  ) {
    return this.workloadsService.updateUserWorkload(id, tenantId, dto as any, actorId, actorRole);
  }
}
