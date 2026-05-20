import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
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
import { PermissionGuard } from '../../shared/guards/permission.guard';
import { RequirePermission } from '../../shared/decorators/require-permission.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { ApiKeysService } from './api-keys.service';
import { CreateProjectDto, UpdateProjectDto, ProjectResponseDto } from './dto/project.dto';
import { CreateApiKeyDto, ApiKeyResponseDto } from './dto/api-key.dto';

@ApiTags('Projects')
@ApiCookieAuth('access_token')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private apiKeysService: ApiKeysService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List projects for a tenant' })
  @ApiQuery({ name: 'tenant_id', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, type: [ProjectResponseDto] })
  findAll(
    @CurrentUser() user: { userId: string; role: string },
    @Query('tenant_id') tenantId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.projectsService.findAll(
      { tenantId: tenantId || undefined, role: user.role },
      parseInt(page),
      parseInt(limit),
      search,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single project' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: false })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
    @Query('tenant_id') tenantId?: string,
  ) {
    return this.projectsService.findOne(id, { tenantId: tenantId || undefined, role: user.role });
  }

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({ status: 201, type: ProjectResponseDto })
  create(
    @CurrentUser() user: { userId: string; role: string },
    @Query('tenant_id') tenantId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create({ tenantId: tenantId || undefined, role: user.role }, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: false })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  update(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
    @Query('tenant_id') tenantId?: string,
    @Body() dto: UpdateProjectDto = {} as UpdateProjectDto,
  ) {
    return this.projectsService.update(id, { tenantId: tenantId || undefined, role: user.role }, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: false })
  @ApiResponse({ status: 200 })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
    @Query('tenant_id') tenantId?: string,
  ) {
    return this.projectsService.remove(id, { tenantId: tenantId || undefined, role: user.role });
  }

  // ── Project Members ───────────────────────────────────────────────────────

  @Get(':id/members')
  @ApiOperation({ summary: 'List all users assigned to a project' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: false })
  getMembers(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
    @Query('tenant_id') tenantId?: string,
  ) {
    return this.projectsService.getMembers(id, { tenantId: tenantId || undefined, role: user.role });
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Assign a user to a project' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: false })
  addMember(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
    @Query('tenant_id') tenantId?: string,
    @Body() dto: { user_id: string; role?: string } = { user_id: '' },
  ) {
    return this.projectsService.addMember(id, { tenantId: tenantId || undefined, role: user.role }, dto);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a user from a project' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'userId' })
  @ApiQuery({ name: 'tenant_id', required: false })
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: { userId: string; role: string },
    @Query('tenant_id') tenantId?: string,
  ) {
    return this.projectsService.removeMember(id, userId, { tenantId: tenantId || undefined, role: user.role });
  }

  // ── API Keys (ADMIN only) ─────────────────────────────────────────────────

  @Post(':id/api-keys')
  @UseGuards(PermissionGuard)
  @RequirePermission('PROJECT_API_KEY_MANAGE')
  @ApiOperation({ summary: 'Create an API key for a project — ADMIN only' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: CreateApiKeyDto })
  @ApiResponse({ status: 201, type: ApiKeyResponseDto, description: 'raw_token is only returned once — store it immediately' })
  createApiKey(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: CreateApiKeyDto,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiKeyResponseDto> {
    return this.apiKeysService.create(id, tenantId, userId, dto);
  }

  @Get(':id/api-keys')
  @UseGuards(PermissionGuard)
  @RequirePermission('PROJECT_API_KEY_MANAGE')
  @ApiOperation({ summary: 'List API keys for a project — ADMIN only' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: [ApiKeyResponseDto] })
  listApiKeys(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
  ): Promise<{ data: ApiKeyResponseDto[] }> {
    return this.apiKeysService.findAll(id, tenantId);
  }

  @Delete(':id/api-keys/:keyId')
  @UseGuards(PermissionGuard)
  @RequirePermission('PROJECT_API_KEY_MANAGE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API key — ADMIN only' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'keyId' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 204 })
  revokeApiKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
    @Query('tenant_id') tenantId: string,
  ): Promise<void> {
    return this.apiKeysService.revoke(keyId, id, tenantId);
  }
}
