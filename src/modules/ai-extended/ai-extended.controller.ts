import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
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
import { AiExtendedService } from './ai-extended.service';
import {
  ClassifyTextDto,
  AISuggestionResponseDto,
  AIDigestResponseDto,
  AIProjectHealthDto,
  AITextClassificationResultDto,
} from './dto/ai-extended.dto';

@ApiTags('AI Extended')
@ApiCookieAuth('access_token')
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiExtendedController {
  constructor(private aiExtendedService: AiExtendedService) {}

  // ── Ticket AI ─────────────────────────────────────────────────────────────

  @Get('classify/:id')
  @ApiOperation({ summary: 'Get AI classification for ticket' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: AISuggestionResponseDto })
  getClassification(@Param('id') id: string) {
    return this.aiExtendedService.getSuggestion(id, 'classification');
  }

  @Get('priority/:id')
  @ApiOperation({ summary: 'Get AI priority suggestion for ticket' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: AISuggestionResponseDto })
  getPriority(@Param('id') id: string) {
    return this.aiExtendedService.getSuggestion(id, 'priority');
  }

  @Get('route/:id')
  @ApiOperation({ summary: 'Get AI routing suggestion for ticket' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: AISuggestionResponseDto })
  getRouting(@Param('id') id: string) {
    return this.aiExtendedService.getSuggestion(id, 'route');
  }

  @Get('suggest-reply/:id')
  @ApiOperation({ summary: 'Get AI suggested reply for ticket' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: AISuggestionResponseDto })
  getSuggestedReply(@Param('id') id: string) {
    return this.aiExtendedService.getSuggestion(id, 'reply');
  }

  @Get('summary/:id')
  @ApiOperation({ summary: 'Get AI summary for ticket' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: AISuggestionResponseDto })
  getSummary(@Param('id') id: string) {
    return this.aiExtendedService.getSuggestion(id, 'summary');
  }

  @Get('eta/:id')
  @ApiOperation({ summary: 'Get AI ETA prediction for ticket' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: AISuggestionResponseDto })
  getETA(@Param('id') id: string) {
    return this.aiExtendedService.getSuggestion(id, 'eta');
  }

  // ── Digest ────────────────────────────────────────────────────────────────

  @Get('digest')
  @ApiOperation({ summary: 'Get AI digest — at-risk tickets, patterns, response gaps' })
  @ApiResponse({ status: 200, type: AIDigestResponseDto })
  getDigest() {
    return this.aiExtendedService.getDigest();
  }

  // ── Text classification ───────────────────────────────────────────────────

  @Post('classify-text')
  @ApiOperation({ summary: 'Classify text via AI' })
  @ApiBody({ type: ClassifyTextDto })
  @ApiResponse({ status: 200, type: AITextClassificationResultDto })
  classifyText(@Body() dto: ClassifyTextDto) {
    return this.aiExtendedService.classifyText(dto);
  }

  // ── Semantic search ───────────────────────────────────────────────────────

  @Get('search')
  @ApiOperation({ summary: 'AI semantic search' })
  @ApiQuery({ name: 'query', example: 'SSO configuration' })
  @ApiQuery({ name: 'scope', required: false, example: 'kb' })
  @ApiResponse({ status: 200 })
  semanticSearch(@Query('query') query: string, @Query('scope') scope?: string) {
    return this.aiExtendedService.semanticSearch(query, scope);
  }

  // ── Similar Tickets ───────────────────────────────────────────────────────

  @Get('similar-tickets')
  @ApiOperation({ summary: 'Find similar resolved/closed tickets by keyword match' })
  @ApiQuery({ name: 'title', example: 'Login SSO broken' })
  @ApiQuery({ name: 'description', required: false, example: 'Users cannot sign in via SSO' })
  @ApiResponse({ status: 200 })
  getSimilarTickets(
    @Query('title') title: string,
    @Query('description') description: string = '',
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.aiExtendedService.getSimilarTickets(title, description, tenantId);
  }

  // ── Suggestion accept / reject ────────────────────────────────────────────

  @Post('suggestions/:id/accept')
  @ApiOperation({ summary: 'Accept AI suggestion' })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { properties: { agentId: { type: 'string', description: 'Required for routing suggestions — assigns this agent to the ticket' } } } })
  @ApiResponse({ status: 200 })
  acceptSuggestion(@Param('id') id: string, @Body('agentId') agentId?: string) {
    return this.aiExtendedService.acceptSuggestion(id, agentId);
  }

  @Post('suggestions/:id/reject')
  @ApiOperation({ summary: 'Reject AI suggestion' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  rejectSuggestion(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.aiExtendedService.rejectSuggestion(id, reason);
  }

  // ── KB AI ─────────────────────────────────────────────────────────────────

  @Get('kb-suggest/:id')
  @ApiOperation({ summary: 'Get KB article suggestions for a ticket (keyword match)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  getKbSuggestions(@Param('id') id: string) {
    return this.aiExtendedService.getKbSuggestions(id);
  }

  @Get('kb-deflect')
  @ApiOperation({ summary: 'Get KB deflections for a free-form query' })
  @ApiQuery({ name: 'query', example: 'SSO login broken' })
  @ApiQuery({ name: 'limit', required: false, example: 5 })
  @ApiResponse({ status: 200 })
  getKbDeflections(@Query('query') query: string, @Query('limit') limit?: string) {
    return this.aiExtendedService.getKbDeflections(query, limit ? parseInt(limit) : 5);
  }

  @Post('kb-draft')
  @ApiOperation({ summary: 'Generate a KB article draft from a topic description' })
  @ApiResponse({ status: 200 })
  generateKbDraft(@Body() dto: { topic: string; context?: string; categoryId?: string; tone?: string }) {
    return this.aiExtendedService.generateKbDraft(dto);
  }

  @Get('kb-gaps')
  @ApiOperation({ summary: 'Get KB coverage gaps detected from recurring ticket patterns' })
  @ApiResponse({ status: 200 })
  getKbGaps() {
    return this.aiExtendedService.getKbGaps();
  }

  @Post('kb-ask')
  @ApiOperation({ summary: 'Ask a question grounded in KB articles (RAG)' })
  @ApiResponse({ status: 200 })
  askKb(@Body() dto: { question: string; articleId?: string; tenant_id?: string }) {
    return this.aiExtendedService.askKb(dto);
  }

  // ── Project AI ────────────────────────────────────────────────────────────

  @Get('projects/:id/health')
  @ApiOperation({ summary: 'Get AI project health score' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: AIProjectHealthDto })
  getProjectHealth(@Param('id') id: string) {
    return this.aiExtendedService.getProjectHealth(id);
  }

  @Get('projects/:id/clusters')
  @ApiOperation({ summary: 'Get semantic ticket clusters within a project' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  getProjectClusters(@Param('id') id: string) {
    return this.aiExtendedService.getProjectClusters(id);
  }

  @Get('projects/:id/scope-drift')
  @ApiOperation({ summary: 'Get tickets flagged as outside project scope' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  getProjectScopeDrift(@Param('id') id: string) {
    return this.aiExtendedService.getProjectScopeDrift(id);
  }

  @Get('projects/:id/churn-risk')
  @ApiOperation({ summary: 'Get churn risk score for a project/client relationship' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  getProjectChurnRisk(@Param('id') id: string) {
    return this.aiExtendedService.getProjectChurnRisk(id);
  }

  @Get('projects/:id/next-action')
  @ApiOperation({ summary: 'Get recommended next action for a project' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  getProjectNextAction(@Param('id') id: string) {
    return this.aiExtendedService.getProjectNextAction(id);
  }

  @Get('projects/:id/status-report')
  @ApiOperation({ summary: 'Get AI-generated weekly status report for a project' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  getProjectStatusReport(@Param('id') id: string) {
    return this.aiExtendedService.getProjectStatusReport(id);
  }

  @Get('projects/:id/milestone-predictions')
  @ApiOperation({ summary: 'Get AI milestone delivery predictions for a project' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  getProjectMilestonePredictions(@Param('id') id: string) {
    return this.aiExtendedService.getProjectMilestonePredictions(id);
  }

  @Post('projects/:id/ask')
  @ApiOperation({ summary: 'Ask a question grounded in project ticket history' })
  @ApiParam({ name: 'id' })
  @ApiBody({ schema: { properties: { question: { type: 'string' } } } })
  @ApiResponse({ status: 200 })
  askProject(@Param('id') id: string, @Body() dto: { question: string }) {
    return this.aiExtendedService.askProject(id, dto);
  }

  // ── Delivery AI ───────────────────────────────────────────────────────────

  @Get('delivery/risk')
  @ApiOperation({ summary: 'Get at-risk delivery features (overdue or tight deadlines)' })
  @ApiResponse({ status: 200 })
  getDeliveryRisk() {
    return this.aiExtendedService.getDeliveryRisk();
  }

  @Post('delivery/prioritise')
  @ApiOperation({ summary: 'AI-ranked prioritisation of delivery backlog' })
  @ApiResponse({ status: 200 })
  prioritiseDelivery() {
    return this.aiExtendedService.prioritiseDelivery();
  }

  @Post('delivery/draft-feature')
  @ApiOperation({ summary: 'AI-generate a delivery feature description' })
  @ApiResponse({ status: 200 })
  draftFeature(@Body() dto: { description?: string; topic?: string; context?: string }) {
    return this.aiExtendedService.draftFeature(dto);
  }

  // ── Onboarding AI ─────────────────────────────────────────────────────────

  @Get('onboarding/:id/health')
  @ApiOperation({ summary: 'Get AI health prediction for an onboarding project' })
  @ApiParam({ name: 'id', description: 'Tenant / onboarding project ID' })
  @ApiResponse({ status: 200 })
  getOnboardingHealth(@Param('id') id: string) {
    return this.aiExtendedService.getOnboardingHealth(id);
  }

  @Post('onboarding/:id/blocker-summary')
  @ApiOperation({ summary: 'Summarise current blockers for an onboarding project' })
  @ApiParam({ name: 'id', description: 'Tenant / onboarding project ID' })
  @ApiResponse({ status: 200 })
  getOnboardingBlockerSummary(@Param('id') id: string) {
    return this.aiExtendedService.getOnboardingBlockerSummary(id);
  }

  @Get('onboarding/:id/next-action')
  @ApiOperation({ summary: 'Get the suggested next action for an onboarding project' })
  @ApiParam({ name: 'id', description: 'Tenant / onboarding project ID' })
  @ApiResponse({ status: 200 })
  getOnboardingNextAction(@Param('id') id: string) {
    return this.aiExtendedService.getOnboardingNextAction(id);
  }

  // ── Roadmap AI ────────────────────────────────────────────────────────────

  @Get('roadmap/summary')
  @ApiOperation({ summary: 'Get AI-personalised roadmap summary' })
  @ApiResponse({ status: 200 })
  getRoadmapSummary() {
    return this.aiExtendedService.getRoadmapSummary();
  }

  @Post('roadmap/classify-request')
  @ApiOperation({ summary: 'Classify a feature request via AI' })
  @ApiResponse({ status: 200 })
  classifyFeatureRequest(@Body() dto: { title?: string; description?: string; text?: string }) {
    return this.aiExtendedService.classifyFeatureRequest(dto);
  }

  // ── User / Agent AI ───────────────────────────────────────────────────────

  @Get('users/assign-suggest/:id')
  @ApiOperation({ summary: 'Get top agent suggestions for a ticket' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  getAssignSuggestions(@Param('id') id: string) {
    return this.aiExtendedService.getAssignSuggestions(id);
  }

  @Get('users/skill-gaps')
  @ApiOperation({ summary: 'Get skill coverage gaps across open tickets' })
  @ApiResponse({ status: 200 })
  getSkillGaps() {
    return this.aiExtendedService.getSkillGaps();
  }

  @Post('users/suggest-skills/:id')
  @ApiOperation({ summary: 'Suggest skills for an agent based on team coverage gaps' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200 })
  suggestSkills(@Param('id') id: string) {
    return this.aiExtendedService.suggestSkills(id);
  }
}
