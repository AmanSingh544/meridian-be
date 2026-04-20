import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export type TaskType = 'classify' | 'summarize' | 'reply' | 'route' | 'embed' | 'health_analysis' | 'priority_score';
export type BudgetTier = 'economy' | 'standard' | 'premium';

interface ProviderConfig {
  name: string;
  client: any;
  costPer1kTokens: number;
  qualityScore: number;
  latencyMs: number;
  model: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private providers: Map<string, ProviderConfig> = new Map();

  constructor(private config: ConfigService) {
    // Initialize OpenAI
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      const openai = new OpenAI({ apiKey: openaiKey });
      this.providers.set('openai-gpt4o', {
        name: 'openai-gpt4o',
        client: openai,
        costPer1kTokens: 0.005,
        qualityScore: 95,
        latencyMs: 800,
        model: 'gpt-4o',
      });
      this.providers.set('openai-gpt4o-mini', {
        name: 'openai-gpt4o-mini',
        client: openai,
        costPer1kTokens: 0.00015,
        qualityScore: 80,
        latencyMs: 300,
        model: 'gpt-4o-mini',
      });
      this.providers.set('openai-embedding', {
        name: 'openai-embedding',
        client: openai,
        costPer1kTokens: 0.00002,
        qualityScore: 90,
        latencyMs: 200,
        model: 'text-embedding-3-small',
      });
    }

    // Initialize Anthropic (if key provided)
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.providers.set('anthropic-haiku', {
        name: 'anthropic-haiku',
        client: null, // Implement Anthropic SDK if needed
        costPer1kTokens: 0.00025,
        qualityScore: 75,
        latencyMs: 400,
        model: 'claude-3-haiku-20240307',
      });
    }
  }

  private selectProvider(taskType: TaskType, budgetTier: BudgetTier = 'standard'): ProviderConfig {
    const providers = Array.from(this.providers.values());
    
    // Filter out embedding-only provider for chat tasks
    const chatProviders = providers.filter(p => !p.name.includes('embedding'));
    
    if (budgetTier === 'economy') {
      // Pick cheapest/fastest
      return chatProviders.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens)[0];
    }
    
    if (budgetTier === 'premium' || ['health_analysis', 'route'].includes(taskType)) {
      // Pick highest quality
      return chatProviders.sort((a, b) => b.qualityScore - a.qualityScore)[0];
    }
    
    // Default: balance quality and cost
    return chatProviders.find(p => p.name === 'openai-gpt4o-mini') || chatProviders[0];
  }

  async classifyTicket(title: string, description: string, budgetTier?: BudgetTier) {
    const provider = this.selectProvider('classify', budgetTier);
    
    const prompt = `Analyze this support ticket and respond with ONLY a JSON object:
{
  "category": "one of: bug, feature_request, billing, technical_support, account_issue",
  "priority": "one of: low, medium, high, urgent",
  "confidence": 0.0-1.0
}

Title: ${title}
Description: ${description}`;

    try {
      const response = await (provider.client as OpenAI).chat.completions.create({
        model: provider.model,
        messages: [
          { role: 'system', content: 'You are a precise support ticket classifier. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 256,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`AI classification failed: ${error.message}`);
      return { category: 'technical_support', priority: 'medium', confidence: 0 };
    }
  }

  async summarizeTicket(ticketContent: string, budgetTier?: BudgetTier) {
    const provider = this.selectProvider('summarize', budgetTier);
    
    try {
      const response = await (provider.client as OpenAI).chat.completions.create({
        model: provider.model,
        messages: [
          { role: 'system', content: 'Summarize the following support ticket in 2-3 sentences. Be concise and capture the key issue and any action items.' },
          { role: 'user', content: ticketContent },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      return {
        summary: response.choices[0]?.message?.content || '',
        provider: provider.name,
      };
    } catch (error) {
      this.logger.error(`AI summarization failed: ${error.message}`);
      return { summary: '', provider: provider.name };
    }
  }

  async generateReply(ticketContent: string, context: string, tone: string = 'professional', budgetTier?: BudgetTier) {
    const provider = this.selectProvider('reply', budgetTier);
    
    try {
      const response = await (provider.client as OpenAI).chat.completions.create({
        model: provider.model,
        messages: [
          { role: 'system', content: `You are a helpful support agent. Respond in a ${tone} tone. Use the provided knowledge base context if relevant.` },
          { role: 'user', content: `Ticket: ${ticketContent}\n\nContext from KB: ${context}` },
        ],
        temperature: 0.4,
        max_tokens: 800,
      });

      return {
        reply: response.choices[0]?.message?.content || '',
        provider: provider.name,
      };
    } catch (error) {
      this.logger.error(`AI reply generation failed: ${error.message}`);
      return { reply: '', provider: provider.name };
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const provider = this.providers.get('openai-embedding');
    if (!provider) throw new Error('No embedding provider configured');

    try {
      const response = await (provider.client as OpenAI).embeddings.create({
        model: provider.model,
        input: text.substring(0, 8000), // Token limit safety
      });

      return response.data[0]?.embedding || [];
    } catch (error) {
      this.logger.error(`Embedding generation failed: ${error.message}`);
      return [];
    }
  }

  async semanticSearch(query: string, tenantId: string, limit: number = 5) {
    const embedding = await this.generateEmbedding(query);
    if (!embedding.length) return [];

    // This would call Prisma raw query with pgvector
    // Implementation depends on your Prisma setup with vector extension
    return [];
  }

  getProviderStatus() {
    return Array.from(this.providers.values()).map(p => ({
      name: p.name,
      model: p.model,
      available: !!p.client || p.name === 'anthropic-haiku',
      costPer1kTokens: p.costPer1kTokens,
      qualityScore: p.qualityScore,
    }));
  }
}
