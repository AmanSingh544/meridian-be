import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiCookieAuth('access_token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users in a tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false })
  findAll(
    @Query('tenant_id') tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.usersService.findAll(tenantId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      role,
    });
  }

  @Get('workload-summary')
  @ApiOperation({ summary: 'Aggregated workload stats across all internal agents' })
  @ApiQuery({ name: 'tenant_id', required: true })
  getWorkloadSummary(@Query('tenant_id') tenantId: string) {
    return this.usersService.getWorkloadSummary(tenantId);
  }

  @Get('scoring-weights')
  @ApiOperation({ summary: 'Get global assignment scoring weights' })
  getScoringWeights() {
    return { data: { id: 'global', wSkill: 0.5, wWorkload: 0.35, wAvail: 0.15 } };
  }

  @Patch('scoring-weights')
  @ApiOperation({ summary: 'Update global assignment scoring weights' })
  updateScoringWeights(@Body() dto: any) {
    return { data: { id: 'global', ...dto } };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user\'s own profile' })
  getMe(@CurrentUser('userId') userId: string, @CurrentUser('tenantId') tenantId: string) {
    return this.usersService.findOne(userId, tenantId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user\'s own profile' })
  updateMe(
    @CurrentUser('userId') userId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: any,
  ) {
    return this.usersService.update(userId, tenantId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single user by ID' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  findOne(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.usersService.findOne(id, tenantId);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite / create a new user in the tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  invite(@Body() dto: any, @Query('tenant_id') tenantId: string) {
    return this.usersService.invite({ ...dto, tenant_id: tenantId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile fields' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @Query('tenant_id') tenantId: string,
  ) {
    return this.usersService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  remove(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.usersService.remove(id, tenantId);
  }

  // ── Permissions ──────────────────────────────────────────────────────────

  @Get(':id/permissions')
  @ApiOperation({ summary: 'Get all permission overrides for a user' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  getPermissions(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.usersService.getPermissions(id, tenantId);
  }

  @Patch(':id/permissions')
  @ApiOperation({ summary: 'Create or update a GRANT/REVOKE permission override' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  upsertPermission(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: { permission: string; type: 'GRANT' | 'REVOKE'; reason?: string },
    @CurrentUser('userId') actorId: string,
    @CurrentUser('role') actorRole: string,
  ) {
    return this.usersService.upsertPermission(id, tenantId, dto, actorId, actorRole);
  }

  // ── Workload ─────────────────────────────────────────────────────────────

  @Get(':id/workload')
  @ApiOperation({ summary: 'Get workload snapshot for a user' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: false })
  getWorkload(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @CurrentUser('tenantId') jwtTenantId: string,
  ) {
    return this.usersService.getWorkload(id, tenantId ?? jwtTenantId);
  }

  @Patch(':id/workload')
  @ApiOperation({ summary: 'Update max_capacity and/or availability_status' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: false })
  updateWorkload(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: { max_capacity?: number; availability_status?: string },
    @CurrentUser('userId') actorId: string,
    @CurrentUser('role') actorRole: string,
    @CurrentUser('tenantId') jwtTenantId: string,
  ) {
    return this.usersService.updateWorkload(id, tenantId ?? jwtTenantId, dto, actorId, actorRole);
  }

  // ── Admin password reset ─────────────────────────────────────────────────

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Admin-initiated password reset for a target user' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  adminResetPassword(
    @Param('id') id: string,
    @CurrentUser('userId') actorId: string,
    @Query('tenant_id') tenantId: string,
  ) {
    return this.usersService.adminResetPassword(id, actorId, tenantId);
  }
}
