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
import { OnboardingService } from './onboarding.service';
import {
  UpdateOnboardingTaskDto,
  CreateOnboardingProjectDto,
  UpdateOnboardingProjectDto,
  OnboardingProjectDto,
} from './dto/onboarding.dto';

@ApiTags('Onboarding')
@ApiCookieAuth('access_token')
@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Get()
  @ApiOperation({ summary: 'List all onboarding projects across tenants (internal console)' })
  @ApiResponse({ status: 200, type: [OnboardingProjectDto] })
  findAll() {
    return this.onboardingService.findAll();
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my onboarding project' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: OnboardingProjectDto })
  findMy(@Query('tenant_id') tenantId: string) {
    return this.onboardingService.findMy(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single onboarding project' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: false })
  @ApiResponse({ status: 200, type: OnboardingProjectDto })
  findOne(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.onboardingService.findOne(id, tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new onboarding project with initial tasks' })
  @ApiBody({ type: CreateOnboardingProjectDto })
  @ApiResponse({ status: 201, type: OnboardingProjectDto })
  create(@Body() dto: CreateOnboardingProjectDto) {
    return this.onboardingService.createProject(dto);
  }

  @Patch(':onboardingId/tasks/:taskId')
  @ApiOperation({ summary: 'Update a single onboarding task status' })
  @ApiParam({ name: 'onboardingId' })
  @ApiParam({ name: 'taskId' })
  @ApiBody({ type: UpdateOnboardingTaskDto })
  @ApiResponse({ status: 200, type: OnboardingProjectDto })
  updateTask(
    @Param('onboardingId') onboardingId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateOnboardingTaskDto,
  ) {
    return this.onboardingService.updateTask(onboardingId, taskId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update onboarding project fields (go-live date, status)' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateOnboardingProjectDto })
  @ApiResponse({ status: 200, type: OnboardingProjectDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOnboardingProjectDto,
  ) {
    return this.onboardingService.updateProject(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete all onboarding tasks for a project (by tenant/org id)' })
  @ApiParam({ name: 'id', description: 'Organization / tenant ID' })
  @ApiResponse({ status: 200 })
  remove(@Param('id') id: string) {
    return this.onboardingService.removeProject(id);
  }
}
