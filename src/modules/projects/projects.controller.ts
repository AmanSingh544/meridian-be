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
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, ProjectResponseDto } from './dto/project.dto';

@ApiTags('Projects')
@ApiCookieAuth('access_token')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects' })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'page_size', required: false, example: '20' })
  @ApiResponse({ status: 200, type: [ProjectResponseDto] })
  findAll(@Query('page') page: string = '1', @Query('page_size') pageSize: string = '20') {
    return this.projectsService.findAll(parseInt(page), parseInt(pageSize));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single project' })
  @ApiParam({ name: 'id', example: 'prj_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({ status: 201, type: ProjectResponseDto })
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiParam({ name: 'id', example: 'prj_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }
}
