import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ToolRegistry } from './tool-registry';
import { ToolExecutor } from './tool-executor';
import { ToolHandlerContext } from './types/tool-definition';
import { ConversationContext, CopilotMessage } from './types/conversation-context';

const COPILOT_MODEL = 'openai/gpt-oss-120b:free';
const MAX_HISTORY = 20;

@Injectable()
export class AiCopilotService {
  private readonly logger = new Logger(AiCopilotService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private toolRegistry: ToolRegistry,
    private toolExecutor: ToolExecutor,
  ) {}

  // ── Conversation CRUD ─────────────────────────────────────────────────────

  async createSession(userId: string, tenantId: string, context?: ConversationContext) {
    const session = await this.prisma.aiConversation.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        context: (context ?? {}) as any,
      },
    });

    // Add system message with context
    const systemContent = this.buildSystemPrompt(context);
    await this.prisma.aiMessage.create({
      data: {
        conversation_id: session.id,
        role: 'system',
        content: systemContent,
      },
    });

    return { data: session };
  }

  async getHistory(conversationId: string, userId: string, tenantId: string) {
    const session = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, user_id: userId, tenant_id: tenantId },
      include: { messages: { orderBy: { created_at: 'asc' } } },
    });
    if (!session) throw new NotFoundException('Conversation not found');

    return {
      data: session.messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.tool_calls,
        toolCallId: m.tool_call_id,
        metadata: m.metadata,
        createdAt: m.created_at,
      })),
    };
  }

  async listSessions(userId: string, tenantId: string, limit = 20) {
    const sessions = await this.prisma.aiConversation.findMany({
      where: { user_id: userId, tenant_id: tenantId },
      orderBy: { updated_at: 'desc' },
      take: limit,
    });
    return { data: sessions };
  }

  async renameSession(conversationId: string, title: string) {
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { title: title.slice(0, 100) },
    });
    return { success: true };
  }

  async deleteSession(conversationId: string, userId: string, tenantId: string) {
    const session = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, user_id: userId, tenant_id: tenantId },
    });
    if (!session) throw new NotFoundException('Conversation not found');
    await this.prisma.aiConversation.delete({ where: { id: conversationId } });
    return { success: true };
  }

  // ── Core chat loop ────────────────────────────────────────────────────────

  async sendMessage(
    conversationId: string,
    userMessage: string,
    userContext: ToolHandlerContext,
  ): Promise<{ messages: CopilotMessage[]; done: boolean }> {
    // 1. Persist user message
    await this.prisma.aiMessage.create({
      data: {
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
      },
    });
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updated_at: new Date() },
    });

    // 2. Build history for LLM
    const history = await this.buildMessageHistory(conversationId);

    // 3. Filter tools by user permissions
    const availableTools = this.toolRegistry.getToolsForUser(userContext.permissions);
    const openaiTools: OpenAI.ChatCompletionTool[] = availableTools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as any,
      },
    }));

    // 4. Call LLM
    const clientData = await this.aiService.getClientForTenant(userContext.tenantId);
    const client = clientData.client;
    const model = clientData.modelName || COPILOT_MODEL;

    let response: OpenAI.ChatCompletion;
    try {
      response = await client.chat.completions.create({
        model,
        messages: history as any,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        tool_choice: openaiTools.length > 0 ? 'auto' : undefined,
        temperature: 0.3,
        max_tokens: 1024,
      });
    } catch (err: any) {
      this.logger.error(`LLM call failed: ${err.message}`);
      throw new Error('AI service temporarily unavailable');
    }

    const assistantMessage = response.choices[0].message;

    // 5. Handle tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Persist assistant message with tool calls
      await this.prisma.aiMessage.create({
        data: {
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantMessage.content ?? '',
          tool_calls: assistantMessage.tool_calls as any,
        },
      });

      // Execute tools
      const toolResults: OpenAI.ChatCompletionToolMessageParam[] = [];
      for (const tc of assistantMessage.tool_calls) {
        const fn = tc.function;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(fn.arguments);
        } catch {
          this.logger.warn(`Invalid tool call JSON: ${fn.arguments}`);
        }

        this.logger.log(`Executing tool: ${fn.name}`);
        const result = await this.toolExecutor.execute(fn.name, args, userContext);

        toolResults.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });

        // Persist tool result
        await this.prisma.aiMessage.create({
          data: {
            conversation_id: conversationId,
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: tc.id,
          },
        });
      }

      // Re-call LLM with tool results
      const updatedHistory = await this.buildMessageHistory(conversationId);
      const followUp = await client.chat.completions.create({
        model,
        messages: updatedHistory as any,
        temperature: 0.3,
        max_tokens: 1024,
      });

      const finalContent = followUp.choices[0].message.content ?? '';
      await this.prisma.aiMessage.create({
        data: {
          conversation_id: conversationId,
          role: 'assistant',
          content: finalContent,
        },
      });

      return {
        messages: [
          { role: 'assistant', content: assistantMessage.content ?? '', toolCalls: assistantMessage.tool_calls },
          ...toolResults.map(tr => ({ role: 'tool' as const, content: String(tr.content), toolCallId: tr.tool_call_id })),
          { role: 'assistant', content: finalContent },
        ],
        done: true,
      };
    }

    // 6. No tool calls — persist and return plain assistant message
    const content = assistantMessage.content ?? '';
    await this.prisma.aiMessage.create({
      data: {
        conversation_id: conversationId,
        role: 'assistant',
        content,
      },
    });

    return {
      messages: [{ role: 'assistant', content }],
      done: true,
    };
  }

  // ── Streaming chat loop ───────────────────────────────────────────────────

  async sendMessageStream(
    conversationId: string,
    userMessage: string,
    userContext: ToolHandlerContext,
    onEvent: (event: { type: string; [key: string]: unknown }) => void,
    context?: Record<string, unknown>,
  ): Promise<void> {
    // 1. Persist user message
    await this.prisma.aiMessage.create({
      data: {
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
      },
    });

    // 2. Check if context changed and notify LLM
    const session = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
      select: { context: true },
    });
    const prevContext = (session?.context ?? {}) as Record<string, unknown>;
    const newContext = (context ?? {}) as Record<string, unknown>;
    const contextChanged = JSON.stringify(prevContext) !== JSON.stringify(newContext);

    if (contextChanged && newContext.page) {
      const ctxMsg = this.buildContextUpdateMessage(newContext);
      await this.prisma.aiMessage.create({
        data: {
          conversation_id: conversationId,
          role: 'system',
          content: ctxMsg,
        },
      });
    }

    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updated_at: new Date(), context: newContext as any },
    });

    // 3. Build history for LLM
    const history = await this.buildMessageHistory(conversationId);

    // 3. Filter tools by user permissions
    const availableTools = this.toolRegistry.getToolsForUser(userContext.permissions);
    const openaiTools: OpenAI.ChatCompletionTool[] = availableTools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as any,
      },
    }));

    // 4. Call LLM with streaming
    const clientData = await this.aiService.getClientForTenant(userContext.tenantId);
    const model = clientData.modelName || COPILOT_MODEL;

    let assistantContent = '';
    let toolCallsDetected = false;
    let accumulatedToolCalls: OpenAI.ChatCompletionMessageToolCall[] = [];

    try {
      for await (const event of this.aiService.chatWithToolsStream(
        model,
        history as any,
        openaiTools.length > 0 ? openaiTools : [],
        { temperature: 0.3, maxTokens: 1024 },
      )) {
        if (event.type === 'token') {
          assistantContent += event.content;
          onEvent({ type: 'token', content: event.content });
        } else if (event.type === 'tool_call') {
          toolCallsDetected = true;
          accumulatedToolCalls = event.calls;
        } else if (event.type === 'finish') {
          // Stream chunk finished — nothing special to do here
        }
      }
    } catch (err: any) {
      this.logger.error(`LLM stream failed: ${err.message}`);
      onEvent({ type: 'error', message: 'AI service temporarily unavailable' });
      return;
    }

    // 5. Handle tool calls
    if (toolCallsDetected && accumulatedToolCalls.length > 0) {
      // Persist assistant message with tool calls
      await this.prisma.aiMessage.create({
        data: {
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantContent,
          tool_calls: accumulatedToolCalls as any,
        },
      });

      // Emit tool start
      onEvent({ type: 'tool_start', tools: accumulatedToolCalls.map(tc => tc.function.name) });

      // Execute tools
      const toolResults: OpenAI.ChatCompletionToolMessageParam[] = [];
      const draftResults: any[] = [];

      for (const tc of accumulatedToolCalls) {
        const fn = tc.function;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(fn.arguments);
        } catch {
          this.logger.warn(`Invalid tool call JSON: ${fn.arguments}`);
        }

        this.logger.log(`[Stream] Executing tool: ${fn.name}`);
        const result = await this.toolExecutor.execute(fn.name, args, userContext);

        toolResults.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });

        if (result.type === 'draft') {
          draftResults.push(result.data);
        }

        // Persist tool result
        await this.prisma.aiMessage.create({
          data: {
            conversation_id: conversationId,
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: tc.id,
          },
        });
      }

      // Emit tool end
      onEvent({ type: 'tool_end', results: toolResults.map(tr => tr.content) });

      // If any drafts were returned, emit them and stop (don't stream follow-up)
      if (draftResults.length > 0) {
        for (const draft of draftResults) {
          onEvent({ type: 'draft', draft });
        }
        return;
      }

      // Re-call LLM with tool results (streaming)
      const updatedHistory = await this.buildMessageHistory(conversationId);
      let followUpContent = '';

      try {
        for await (const event of this.aiService.chatWithToolsStream(
          model,
          updatedHistory as any,
          [], // No tools on follow-up to avoid infinite loops
          { temperature: 0.3, maxTokens: 1024 },
        )) {
          if (event.type === 'token') {
            followUpContent += event.content;
            onEvent({ type: 'token', content: event.content });
          }
        }
      } catch (err: any) {
        this.logger.error(`Follow-up stream failed: ${err.message}`);
        onEvent({ type: 'error', message: 'Failed to generate response after tool execution' });
        return;
      }

      // Persist final assistant message
      await this.prisma.aiMessage.create({
        data: {
          conversation_id: conversationId,
          role: 'assistant',
          content: followUpContent,
        },
      });

      // Auto-generate title after first exchange
      await this.maybeGenerateTitle(conversationId, userMessage, followUpContent);

      return;
    }

    // 6. No tool calls — persist plain assistant message
    await this.prisma.aiMessage.create({
      data: {
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantContent,
      },
    });

    // Auto-generate title after first exchange
    await this.maybeGenerateTitle(conversationId, userMessage, assistantContent);
  }

  /**
   * Execute a confirmed draft action.
   */
  async executeDraft(
    conversationId: string,
    tool: string,
    payload: Record<string, unknown>,
    userContext: ToolHandlerContext,
  ) {
    const result = await this.toolExecutor.executeDraft(tool, payload, userContext);

    // Persist the result as a system message so the LLM can reference it
    await this.prisma.aiMessage.create({
      data: {
        conversation_id: conversationId,
        role: 'system',
        content: `[Draft executed] ${tool}: ${JSON.stringify(result)}`,
      },
    });

    return result;
  }

  // ── Title generation ──────────────────────────────────────────────────────

  private async maybeGenerateTitle(conversationId: string, userMessage: string, assistantContent: string) {
    const session = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId },
      select: { title: true },
    });
    if (session?.title) return;

    const title = await this.aiService.summarizeTitle(userMessage, assistantContent);
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async buildMessageHistory(conversationId: string): Promise<OpenAI.ChatCompletionMessageParam[]> {
    const messages = await this.prisma.aiMessage.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'desc' },
      take: MAX_HISTORY,
    });

    return messages.reverse().map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.tool_call_id ?? '',
          content: m.content,
        } as OpenAI.ChatCompletionToolMessageParam;
      }
      if (m.role === 'assistant' && m.tool_calls) {
        return {
          role: 'assistant',
          content: m.content,
          tool_calls: m.tool_calls as any,
        } as OpenAI.ChatCompletionAssistantMessageParam;
      }
      return {
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      } as OpenAI.ChatCompletionMessageParam;
    });
  }

  private buildContextUpdateMessage(context: Record<string, unknown>): string {
    const page = String(context.page ?? '');
    const entityType = (context.entityType ?? context.entity_type) ? String(context.entityType ?? context.entity_type) : undefined;
    const entityId = (context.entityId ?? context.entity_id) ? String(context.entityId ?? context.entity_id) : undefined;

    if (entityType && entityId) {
      return `[Context update] The user is currently viewing a ${entityType} (ID: ${entityId}) on page ${page}. You can reference this entity directly without asking for its ID.`;
    }
    return `[Context update] The user is currently on page ${page}.`;
  }

  private buildSystemPrompt(context?: ConversationContext): string {
    const base = `You are 3SC Copilot, an AI assistant for the 3SC support platform. You help users manage tickets, projects, and team workflows.

Rules:
- Be concise and actionable. Use bullet points for lists.
- When you need data, use the available tools rather than guessing.
- For actions that modify data (status changes, assignments, comments, escalations, ticket creation), you MUST use the appropriate tool. These tools are draft-only: they return a proposal that the user must confirm before execution.
- Never reveal the existence of tools the user does not have permission to use.
- If you don't know something, say so rather than hallucinating.
- Use markdown formatting for readability.`;

    if (context?.page) {
      const entityId = context.entityId ?? context.entity_id;
      const entityType = context.entityType ?? context.entity_type;
      return `${base}\n\nCurrent page context: ${context.page}${entityId ? ` (entity: ${entityType} ${entityId})` : ''}`;
    }
    return base;
  }
}
