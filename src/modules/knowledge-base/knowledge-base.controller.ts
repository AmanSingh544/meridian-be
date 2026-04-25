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
import { KnowledgeBaseService } from './knowledge-base.service';
import {
  CreateKbArticleDto,
  UpdateKbArticleDto,
  KbArticleResponseDto,
  KbCategoryResponseDto,
  KbSearchResultDto,
} from './dto/kb.dto';

@ApiTags('Knowledge Base')
@ApiCookieAuth('access_token')
@Controller('knowledge-base')
@UseGuards(JwtAuthGuard)
export class KnowledgeBaseController {
  constructor(private kbService: KnowledgeBaseService) {}

  @Get('articles')
  @ApiOperation({ summary: 'List KB articles for a tenant' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('tenant_id') tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.kbService.findAll(tenantId, { page: parseInt(page), limit: parseInt(limit), status, search });
  }

  @Get('search')
  @ApiOperation({ summary: 'Search KB articles' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiQuery({ name: 'query', required: true })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, type: [KbSearchResultDto] })
  search(
    @Query('tenant_id') tenantId: string,
    @Query('query') query: string,
    @Query('limit') limit = '10',
  ) {
    return this.kbService.search(tenantId, query, parseInt(limit));
  }

  @Get('categories')
  @ApiOperation({ summary: 'List KB categories' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: [KbCategoryResponseDto] })
  getCategories(@Query('tenant_id') tenantId: string) {
    return this.kbService.getCategories(tenantId);
  }

  @Get('articles/:id')
  @ApiOperation({ summary: 'Get a KB article (increments view_count)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200, type: KbArticleResponseDto })
  findOne(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.kbService.findOne(id, tenantId);
  }

  @Post('articles')
  @ApiOperation({ summary: 'Create a KB article' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: CreateKbArticleDto })
  @ApiResponse({ status: 201, type: KbArticleResponseDto })
  create(@Query('tenant_id') tenantId: string, @Body() dto: CreateKbArticleDto) {
    return this.kbService.create(tenantId, dto);
  }

  @Patch('articles/:id')
  @ApiOperation({ summary: 'Update a KB article' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiBody({ type: UpdateKbArticleDto })
  @ApiResponse({ status: 200, type: KbArticleResponseDto })
  update(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: UpdateKbArticleDto,
  ) {
    return this.kbService.update(id, tenantId, dto);
  }

  @Delete('articles/:id')
  @ApiOperation({ summary: 'Delete a KB article' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  remove(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.kbService.remove(id, tenantId);
  }

  @Post('articles/:id/vote')
  @ApiOperation({ summary: 'Vote on a KB article (helpful / not helpful)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  vote(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
    @Body() dto: { helpful: boolean },
  ) {
    return this.kbService.vote(id, tenantId, dto.helpful ?? true);
  }

  @Post('articles/:id/helpful')
  @ApiOperation({ summary: 'Mark article as helpful (alias)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'tenant_id', required: true })
  @ApiResponse({ status: 200 })
  voteHelpful(@Param('id') id: string, @Query('tenant_id') tenantId: string) {
    return this.kbService.vote(id, tenantId, true);
  }
}
