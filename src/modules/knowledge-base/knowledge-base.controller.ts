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
  KbSearchQueryDto,
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

  @Get('search')
  @ApiOperation({ summary: 'Search KB articles' })
  @ApiQuery({ name: 'query', required: true, example: 'azure sso' })
  @ApiQuery({ name: 'limit', required: false, example: '10' })
  @ApiResponse({ status: 200, type: [KbSearchResultDto] })
  search(@Query('query') query: string, @Query('limit') limit?: string) {
    return this.kbService.search(query, limit ? parseInt(limit) : 10);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List KB categories' })
  @ApiResponse({ status: 200, type: [KbCategoryResponseDto] })
  getCategories() {
    return this.kbService.getCategories();
  }

  @Get('articles/:id')
  @ApiOperation({ summary: 'Get a KB article' })
  @ApiParam({ name: 'id', example: 'kb_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 200, type: KbArticleResponseDto })
  findOne(@Param('id') id: string) {
    return this.kbService.findOne(id);
  }

  @Post('articles')
  @ApiOperation({ summary: 'Create a KB article' })
  @ApiBody({ type: CreateKbArticleDto })
  @ApiResponse({ status: 201, type: KbArticleResponseDto })
  create(@Body() dto: CreateKbArticleDto) {
    return this.kbService.create(dto);
  }

  @Patch('articles/:id')
  @ApiOperation({ summary: 'Update a KB article' })
  @ApiParam({ name: 'id', example: 'kb_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiBody({ type: UpdateKbArticleDto })
  @ApiResponse({ status: 200, type: KbArticleResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateKbArticleDto) {
    return this.kbService.update(id, dto);
  }

  @Delete('articles/:id')
  @ApiOperation({ summary: 'Delete a KB article' })
  @ApiParam({ name: 'id', example: 'kb_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@Param('id') id: string) {
    return this.kbService.remove(id);
  }

  @Post('articles/:id/helpful')
  @ApiOperation({ summary: 'Mark article as helpful' })
  @ApiParam({ name: 'id', example: 'kb_01HZX8K7YV7QNSQJQ5ZQFJ9K3M' })
  @ApiResponse({ status: 200 })
  voteHelpful(@Param('id') id: string) {
    return this.kbService.voteHelpful(id);
  }
}
