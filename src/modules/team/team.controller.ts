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
import { UsersService } from '../users/users.service';
import {
  UpdateTeamMemberRoleDto,
  UpdatePermissionDto,
  ScoringWeightsDto,
  TeamMemberResponseDto,
} from './dto/team.dto';

@ApiTags('Team')
@ApiCookieAuth('access_token')
@Controller('team')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private usersService: UsersService) {}

  @Get('members')
  @ApiOperation({ summary: 'List team members in a tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiResponse({ status: 200, type: [TeamMemberResponseDto] })
  findMembers(
    @Query('tenant_id') tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.usersService.findMembers(tenantId, parseInt(page), parseInt(limit), search, role);
  }

  @Patch('members/:id/role')
  @ApiOperation({ summary: 'Change a team member role (clears permission overrides)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: UpdateTeamMemberRoleDto })
  @ApiResponse({ status: 200, type: TeamMemberResponseDto })
  changeRole(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: UpdateTeamMemberRoleDto,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.usersService.changeRole(id, tenantId, (dto as any).role, actorId);
  }

  @Patch('members/:id/permissions')
  @ApiOperation({ summary: 'Toggle a permission override for a member' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: UpdatePermissionDto })
  @ApiResponse({ status: 200, type: TeamMemberResponseDto })
  togglePermission(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: UpdatePermissionDto,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.usersService.togglePermission(id, tenantId, dto as any, actorId);
  }

  @Delete('members/:id')
  @ApiOperation({ summary: 'Deactivate / remove a team member' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  deactivateMember(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.usersService.deactivateMember(id, tenantId, actorId);
  }

  @Get('scoring-weights')
  @ApiOperation({ summary: 'Get agent scoring weights' })
  @ApiResponse({ status: 200, type: ScoringWeightsDto })
  getScoringWeights() {
    return this.usersService.getScoringWeights();
  }

  @Patch('scoring-weights')
  @ApiOperation({ summary: 'Update agent scoring weights' })
  @ApiBody({ type: ScoringWeightsDto })
  @ApiResponse({ status: 200, type: ScoringWeightsDto })
  updateScoringWeights(@Body() dto: ScoringWeightsDto) {
    return this.usersService.updateScoringWeights(dto);
  }
}
