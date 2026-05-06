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
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, ProjectResponseDto } from './dto/project.dto';

@ApiTags('Projects')
@ApiCookieAuth('access_token')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects for a tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, type: [ProjectResponseDto] })
  findAll(
    @Query('tenant_id') tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.projectsService.findAll(tenantId, parseInt(page), parseInt(limit), search, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single project' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  findOne(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.projectsService.findOne(id, tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({ status: 201, type: ProjectResponseDto })
  create(@Query('tenant_id') tenantId: string, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(tenantId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  update(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  remove(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.projectsService.remove(id, tenantId);
  }

  // ── Project Members ───────────────────────────────────────────────────────

  @Get(':id/members')
  @ApiOperation({ summary: 'List all users assigned to a project' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  getMembers(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.projectsService.getMembers(id, tenantId);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Assign a user to a project' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  addMember(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: { user_id: string; role?: string },
  ) {
    return this.projectsService.addMember(id, tenantId, dto);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a user from a project' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'userId' })
  @ApiQuery({ name: 'tenant_id', required: true })
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Query('tenant_id') tenantId: string,
  ) {
    return this.projectsService.removeMember(id, userId, tenantId);
  }
}
