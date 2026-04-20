import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { WorkloadsService } from './workloads.service';
import { UpdateWorkloadDto, WorkloadResponseDto } from './dto/workload.dto';

@ApiTags('Workloads')
@ApiCookieAuth('access_token')
@Controller()
@UseGuards(JwtAuthGuard)
export class WorkloadsController {
  constructor(private workloadsService: WorkloadsService) {}

  @Get('users/:id/workload')
  @ApiOperation({ summary: 'Get user workload' })
  @ApiParam({ name: 'id', example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 200, type: WorkloadResponseDto })
  getUserWorkload(@Param('id') id: string) {
    return this.workloadsService.getUserWorkload(id);
  }

  @Patch('users/:id/workload')
  @ApiOperation({ summary: 'Update user workload' })
  @ApiParam({ name: 'id', example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiBody({ type: UpdateWorkloadDto })
  @ApiResponse({ status: 200, type: WorkloadResponseDto })
  updateUserWorkload(@Param('id') id: string, @Body() dto: UpdateWorkloadDto) {
    return this.workloadsService.updateUserWorkload(id, dto);
  }

  @Get('users/workload-summary')
  @ApiOperation({ summary: 'Get workload summary' })
  @ApiResponse({ status: 200 })
  getWorkloadSummary() {
    return this.workloadsService.getWorkloadSummary();
  }
}
