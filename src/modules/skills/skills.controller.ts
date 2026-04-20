import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'List skills' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, type: [SkillResponseDto] })
  findAll(@Query('category') category?: string, @Query('search') search?: string) {
    return this.skillsService.findAll(category, search);
  }

  @Post('skills')
  @ApiOperation({ summary: 'Create a skill' })
  @ApiBody({ type: CreateSkillDto })
  @ApiResponse({ status: 201, type: SkillResponseDto })
  create(@Body() dto: CreateSkillDto) {
    return this.skillsService.create(dto);
  }

  @Get('users/:id/skills')
  @ApiOperation({ summary: 'Get user skills' })
  @ApiParam({ name: 'id', example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 200, type: [UserSkillResponseDto] })
  getUserSkills(@Param('id') id: string) {
    return this.skillsService.getUserSkills(id);
  }

  @Patch('users/:id/skills')
  @ApiOperation({ summary: 'Update user skills' })
  @ApiParam({ name: 'id', example: 'usr_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiBody({ type: UpdateUserSkillsDto })
  @ApiResponse({ status: 200, type: [UserSkillResponseDto] })
  updateUserSkills(@Param('id') id: string, @Body() dto: UpdateUserSkillsDto) {
    return this.skillsService.updateUserSkills(id, dto);
  }
}
