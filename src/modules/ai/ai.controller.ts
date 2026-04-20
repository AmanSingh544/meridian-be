import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import { ClassifyDto, SummarizeDto, ReplyDto } from './dto/ai-request.dto';
import {
  ClassificationResponseDto,
  SummaryResponseDto,
  ReplyResponseDto,
  ProviderStatusDto,
} from './dto/ai-response.dto';

@ApiTags('AI')
@ApiCookieAuth('access_token')
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('classify')
  @ApiOperation({
    summary: 'Classify a ticket',
    description:
      'Uses AI to suggest category, priority, and confidence score for a ticket based on its title and description.',
  })
  @ApiBody({ type: ClassifyDto })
  @ApiResponse({
    status: 200,
    description: 'Classification result',
    type: ClassificationResponseDto,
  })
  @ApiResponse({ status: 503, description: 'AI provider unavailable' })
  classify(@Body() dto: ClassifyDto) {
    return this.aiService.classifyTicket(
      dto.title,
      dto.description,
      dto.budget_tier,
    );
  }

  @Post('summarize')
  @ApiOperation({
    summary: 'Summarize ticket content',
    description:
      'Generates a concise 2-3 sentence summary of the provided ticket content.',
  })
  @ApiBody({ type: SummarizeDto })
  @ApiResponse({
    status: 200,
    description: 'Summary result',
    type: SummaryResponseDto,
  })
  @ApiResponse({ status: 503, description: 'AI provider unavailable' })
  summarize(@Body() dto: SummarizeDto) {
    return this.aiService.summarizeTicket(dto.content, dto.budget_tier);
  }

  @Post('reply')
  @ApiOperation({
    summary: 'Generate AI reply',
    description:
      'Generates a support agent reply based on ticket content and optional KB context.',
  })
  @ApiBody({ type: ReplyDto })
  @ApiResponse({
    status: 200,
    description: 'Generated reply',
    type: ReplyResponseDto,
  })
  @ApiResponse({ status: 503, description: 'AI provider unavailable' })
  generateReply(@Body() dto: ReplyDto) {
    return this.aiService.generateReply(
      dto.ticket_content,
      dto.context || '',
      dto.tone,
      dto.budget_tier,
    );
  }

  @Get('providers')
  @ApiOperation({
    summary: 'List AI providers',
    description: 'Returns the status and configuration of all configured AI providers.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of providers',
    type: [ProviderStatusDto],
  })
  getProviders() {
    return this.aiService.getProviderStatus();
  }
}
