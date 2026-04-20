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
import { OnboardingService } from './onboarding.service';
import { UpdateOnboardingTaskDto, OnboardingProjectDto } from './dto/onboarding.dto';

@ApiTags('Onboarding')
@ApiCookieAuth('access_token')
@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Get()
  @ApiOperation({ summary: 'List onboarding projects' })
  @ApiResponse({ status: 200, type: [OnboardingProjectDto] })
  findAll() {
    return this.onboardingService.findAll();
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my onboarding project' })
  @ApiResponse({ status: 200, type: OnboardingProjectDto })
  getMyOnboarding() {
    return this.onboardingService.getMyOnboarding();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get onboarding project' })
  @ApiParam({ name: 'id', example: 'onb_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 200, type: OnboardingProjectDto })
  findOne(@Param('id') id: string) {
    return this.onboardingService.findOne(id);
  }

  @Patch(':id/tasks/:taskId')
  @ApiOperation({ summary: 'Update onboarding task' })
  @ApiParam({ name: 'id', example: 'onb_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiParam({ name: 'taskId', example: 'task_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiBody({ type: UpdateOnboardingTaskDto })
  @ApiResponse({ status: 200, type: OnboardingProjectDto })
  updateTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateOnboardingTaskDto,
  ) {
    return this.onboardingService.updateTask(id, taskId, dto);
  }
}
