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
import { SkillsService } from './skills.service';
import { CreateSkillDto, UpdateUserSkillsDto, SkillResponseDto, UserSkillResponseDto } from './dto/skill.dto';

@ApiTags('Skills')
@ApiCookieAuth('access_token')
@Controller()
@UseGuards(JwtAuthGuard)
export class SkillsController {
  constructor(private skillsService: SkillsService) {}

  @Get('skills')
  @ApiOperation({ summary: 'List skills in a tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, type: [SkillResponseDto] })
  findAll(
    @Query('tenant_id') tenantId: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.skillsService.findAll(tenantId, category, search);
  }

  @Post('skills')
  @ApiOperation({ summary: 'Create a skill' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: CreateSkillDto })
  @ApiResponse({ status: 201, type: SkillResponseDto })
  create(@Query('tenant_id') tenantId: string, @Body() dto: CreateSkillDto) {
    return this.skillsService.create(tenantId, dto);
  }

  @Patch('skills/:id')
  @ApiOperation({ summary: 'Update a skill' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: SkillResponseDto })
  update(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: any,
  ) {
    return this.skillsService.update(id, tenantId, dto);
  }

  @Delete('skills/:id')
  @ApiOperation({ summary: 'Delete a skill' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  remove(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.skillsService.remove(id, tenantId);
  }

  @Get('users/:id/skills')
  @ApiOperation({ summary: 'Get skills for a user' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: [UserSkillResponseDto] })
  getUserSkills(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.skillsService.getUserSkills(id, tenantId);
  }

  @Patch('users/:id/skills')
  @ApiOperation({ summary: 'Replace user skills (full replace)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: UpdateUserSkillsDto })
  @ApiResponse({ status: 200, type: [UserSkillResponseDto] })
  replaceUserSkills(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: UpdateUserSkillsDto,
  ) {
    // Support both { skills: [{skill_id, level}] } and legacy { skill_ids: [...] }
    const skills = dto.skills ?? (dto.skill_ids ?? []).map((id) => ({ skill_id: id }));
    return this.skillsService.replaceUserSkills(id, tenantId, skills);
  }
}
