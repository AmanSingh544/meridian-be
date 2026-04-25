import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiCookieAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import { ClassifyDto, SummarizeDto, ReplyDto } from './dto/ai-request.dto';
import { ClassificationResponseDto, SummaryResponseDto, ReplyResponseDto, ProviderStatusDto } from './dto/ai-response.dto';

@ApiTags('AI')
@ApiCookieAuth('access_token')
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('classify')
  @ApiOperation({ summary: 'Classify a ticket — returns category, priority, confidence' })
  @ApiBody({ type: ClassifyDto })
  @ApiResponse({ status: 200, type: ClassificationResponseDto })
  classify(@Body() dto: ClassifyDto) {
    return this.aiService.classifyTicket(dto.title, dto.description);
  }

  @Post('summarize')
  @ApiOperation({ summary: 'Summarize ticket content in 2-3 sentences' })
  @ApiBody({ type: SummarizeDto })
  @ApiResponse({ status: 200, type: SummaryResponseDto })
  summarize(@Body() dto: SummarizeDto) {
    return this.aiService.summarizeTicket(dto.content);
  }

  @Post('reply')
  @ApiOperation({ summary: 'Generate a support agent reply for a ticket' })
  @ApiBody({ type: ReplyDto })
  @ApiResponse({ status: 200, type: ReplyResponseDto })
  generateReply(@Body() dto: ReplyDto) {
    return this.aiService.generateReply(dto.ticket_content, dto.context ?? '', dto.tone);
  }

  @Get('providers')
  @ApiOperation({ summary: 'Get AI provider status and model assignments' })
  @ApiResponse({ status: 200, type: ProviderStatusDto })
  getProviders() {
    return this.aiService.getProviderStatus();
  }
}
