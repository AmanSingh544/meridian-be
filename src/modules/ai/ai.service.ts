import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

// Models — primary + fallback chain (all free tier on OpenRouter)
const MODEL_ANALYTICAL = 'nvidia/nemotron-3-super-120b-a12b:free'; // classify, summarize, route, analysis
const MODEL_GENERATIVE = 'openai/gpt-oss-120b:free';              // reply generation, KB draft
const MODEL_EMBED = 'nvidia/llama-nemotron-embed-vl-1b-v2:free'; // embeddings

// Fallback chain tried in order when primary is unavailable (503/402/429 etc.)
const GENERATIVE_FALLBACKS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'google/gemma-4-31b-it:free',
  'z-ai/glm-4.5-air:free',
];

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: OpenAI | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    if (apiKey) {
      this.client = new OpenAI({
        baseURL: OPENROUTER_BASE,
        apiKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://3sc-platform.railway.app',
          'X-Title': '3SC Platform',
        },
      });
    } else {
      this.logger.warn('OPENROUTER_API_KEY not set — AI features disabled');
    }
  }

  private get isAvailable(): boolean {
    return !!this.client;
  }

  // ── JSON parsing helpers ──────────────────────────────────────────────────

  /** Strip markdown fences and extract the first complete JSON object/array. */
  private parseJson(raw: string): any {
    // Remove markdown code fences
    let clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    // Try direct parse first
    try {
      return JSON.parse(clean);
    } catch {
      // Extract the first balanced {...} block to handle trailing text / truncation
      const start = clean.indexOf('{');
      if (start === -1) throw new SyntaxError('No JSON object found in response');

      let depth = 0;
      let inString = false;
      let escape = false;
      let end = -1;

      for (let i = start; i < clean.length; i++) {
        const ch = clean[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
      }

      if (end !== -1) return JSON.parse(clean.slice(start, end + 1));
      throw new SyntaxError('Could not extract complete JSON from response');
    }
  }

  // ── Core chat call ────────────────────────────────────────────────────────

  private async chat(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    opts: { json?: boolean; maxTokens?: number } = {},
  ): Promise<string> {
    if (!this.client) throw new Error('AI provider not configured');

    const tryModel = async (m: string) =>
      this.client!.chat.completions.create({
        model: m,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: opts.json ? 0.1 : 0.4,
        max_tokens: opts.maxTokens ?? 512,
        ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
      } as any);

    const chain = (model === MODEL_GENERATIVE || model === MODEL_ANALYTICAL)
      ? [model, ...GENERATIVE_FALLBACKS]
      : [model];

    let lastErr: any;
    for (const m of chain) {
      try {
        const response = await tryModel(m);
        // OpenRouter sometimes returns 200 with an error body instead of choices
        if (!response.choices?.length) {
          const routerErr = (response as any).error;
          const fakeErr: any = new Error(routerErr?.message ?? 'Empty choices in response');
          fakeErr.status = routerErr?.code ?? 503;
          throw fakeErr;
        }
        if (m !== model) this.logger.warn(`chat: primary ${model} failed — used fallback ${m}`);
        return response.choices[0].message?.content ?? '';
      } catch (err: any) {
        const status = err?.status ?? err?.response?.status;
        // 400/404: model-specific rejection (unsupported params, bad slug)
        // 429/502/503: rate limit or provider down — all retryable across models
        const retryable = [400, 402, 404, 429, 502, 503].includes(status);
        this.logger.warn(`chat: ${m} returned ${status ?? 'unknown'} — ${retryable ? 'trying next' : 'propagating'}`);
        if (retryable) { lastErr = err; continue; }
        throw err;
      }
    }
    throw lastErr;
  }

  // ── Classify ──────────────────────────────────────────────────────────────

  async classifyTicket(title: string, description: string) {
    if (!this.isAvailable) {
      return this.classifyFallback('none');
    }

    try {
      const raw = await this.chat(
        MODEL_ANALYTICAL,
        'You are a precise support ticket classifier. Respond ONLY with valid JSON, no markdown, no explanation.',
        `Classify this support ticket and respond with exactly this JSON (no extra keys):
        {
          "category": "INCIDENT | BUG | FEATURE_REQUEST | QUESTION | SUPPORT | BILLING | TASK",
          "priority": "LOW | MEDIUM | HIGH | URGENT",
          "categoryConfidence": 0.0,
          "priorityConfidence": 0.0,
          "categoryReasoning": "one sentence",
          "priorityReasoning": "one sentence",
          "priorityFactors": ["factor1", "factor2"]
        }

        Title: ${title}
        Description: ${description.slice(0, 500)}`,
                { json: true, maxTokens: 512 },
              );

      const parsed = this.parseJson(raw);

      return {
        category: parsed.category ?? 'SUPPORT',
        priority: parsed.priority ?? 'MEDIUM',
        categoryConfidence: parsed.categoryConfidence ?? parsed.confidence ?? 0.7,
        priorityConfidence: parsed.priorityConfidence ?? parsed.confidence ?? 0.7,
        categoryReasoning: parsed.categoryReasoning ?? '',
        priorityReasoning: parsed.priorityReasoning ?? '',
        priorityFactors: Array.isArray(parsed.priorityFactors) ? parsed.priorityFactors : [],
        provider: MODEL_ANALYTICAL,
      };
    } catch (err) {
      this.logger.error(`classifyTicket failed: ${err.message}`);
      return this.classifyFallback(MODEL_ANALYTICAL);
    }
  }

  private classifyFallback(provider: string) {
    return {
      category: 'SUPPORT',
      priority: 'MEDIUM',
      categoryConfidence: 0,
      priorityConfidence: 0,
      categoryReasoning: '',
      priorityReasoning: '',
      priorityFactors: [] as string[],
      provider,
    };
  }

  // ── Summarize ─────────────────────────────────────────────────────────────

  async summarizeTicket(content: string) {
    if (!this.isAvailable) return { summary: '', provider: 'none' };

    try {
      const summary = await this.chat(
        MODEL_ANALYTICAL,
        'Summarize the following support ticket in 2-3 sentences. Be concise — capture the core issue and any action items.',
        content,
        { maxTokens: 300 },
      );
      return { summary, provider: MODEL_ANALYTICAL };
    } catch (err) {
      this.logger.error(`summarizeTicket failed: ${err.message}`);
      return { summary: '', provider: MODEL_ANALYTICAL };
    }
  }

  // ── RAG helpers ───────────────────────────────────────────────────────────

  // Split article content into ~300-char overlapping chunks
  private chunkText(text: string, size = 300): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks;
  }

  // Trim a string to at most maxChars characters
  private trim(text: string, maxChars: number): string {
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  }

  // Score a chunk against query terms (0 = no overlap, higher = more overlap)
  private chunkScore(chunk: string, terms: string[]): number {
    const lower = chunk.toLowerCase();
    return terms.reduce((acc, t) => acc + (lower.includes(t) ? 1 : 0), 0);
  }

  // Pick the top-2 most relevant chunks from a single article
  private topChunks(content: string, terms: string[], chunkSize = 300): string[] {
    const chunks = this.chunkText(content, chunkSize);
    return chunks
      .map((c) => ({ c, s: this.chunkScore(c, terms) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 2)
      .map((x) => x.c);
  }

  /**
   * Build a compact, citation-prefixed RAG context from KB article objects.
   * Each article must have at least { title, content }.
   * Falls back to accepting a pre-built context string for backward-compat.
   */
  buildRagContext(
    articlesOrContext: Array<{ title: string; content: string; id?: string }> | string,
    query: string,
    maxContextChars = 2500,
  ): { context: string; sources: Array<{ id?: string; title: string }> } {
    // Backward compat: if a plain string is passed, return it as-is
    if (typeof articlesOrContext === 'string') {
      return { context: this.trim(articlesOrContext, maxContextChars), sources: [] };
    }

    const articles = articlesOrContext;
    if (!articles.length) return { context: '', sources: [] };

    const terms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const chunks: string[] = [];
    const sources: Array<{ id?: string; title: string }> = [];
    let budget = maxContextChars;

    for (const article of articles.slice(0, 4)) {
      if (budget <= 0) break;
      const selected = this.topChunks(article.content ?? '', terms);
      for (const chunk of selected) {
        const line = `[${article.title}] ${chunk}`;
        if (line.length > budget) break;
        chunks.push(line);
        budget -= line.length;
      }
      sources.push({ id: article.id, title: article.title });
    }

    return { context: chunks.join('\n\n'), sources };
  }

  // ── Reply generation (RAG-aware) ─────────────────────────────────────────

  /**
   * Generate a reply grounded in KB context.
   * `articlesOrContext` can be:
   *   - KB article objects  → full RAG pipeline (chunk + rank + cite)
   *   - a plain string      → legacy path, trimmed and sent directly
   */
  async generateReply(
    ticketContent: string,
    articlesOrContext: Array<{ title: string; content: string; id?: string }> | string,
    tone = 'professional',
  ) {
    if (!this.isAvailable) return { reply: '', sources: [], provider: 'none' };

    const { context, sources } = this.buildRagContext(articlesOrContext, ticketContent);

    const safeTicket = this.trim(ticketContent, 1500);
    const safeContext = context || 'No relevant KB articles found.';

    const systemPrompt = [
      `You are a helpful support agent. Respond in a ${tone} tone.`,
      'Use the KB context only when it is relevant to the question.',
      'If you reference a KB article, mention its title.',
      'If the context does not help, answer from general knowledge and say so briefly.',
      'Keep the answer concise (under 200 words).',
    ].join(' ');

    const userPrompt = `Ticket / Question:\n${safeTicket}\n\nKB Context:\n${safeContext}`;

    try {
      const reply = await this.chat(MODEL_GENERATIVE, systemPrompt, userPrompt, { maxTokens: 500 });
      return { reply, sources, provider: MODEL_GENERATIVE };
    } catch (err: any) {
      this.logger.error('generateReply failed — all models exhausted', {
        message: err.message,
        status: err?.status ?? err?.response?.status,
      });
      return { reply: '', sources: [], provider: 'error' };
    }
  }

  // ── KB draft ──────────────────────────────────────────────────────────────

  async generateKbDraft(topic: string, context?: string) {
    if (!this.isAvailable) return { title: '', content: '', provider: 'none' };

    try {
      const raw = await this.chat(
        MODEL_GENERATIVE,
        'You are a technical writer creating knowledge base articles. Respond ONLY with valid JSON.',
        `Write a knowledge base article about: "${topic}"
${context ? `Context: ${context}` : ''}

Respond with:
{
  "title": "article title",
  "content": "full markdown article content"
}`,
        { json: true, maxTokens: 2048 },
      );
      const parsed = this.parseJson(raw);
      return { ...parsed, provider: MODEL_GENERATIVE };
    } catch (err) {
      this.logger.error(`generateKbDraft failed: ${err.message}`);
      return { title: topic, content: '', provider: MODEL_GENERATIVE };
    }
  }

  // ── Route suggestion ──────────────────────────────────────────────────────

  async suggestRoute(
    ticketTitle: string,
    ticketDesc: string,
    agents: Array<{ id: string; name: string; skills: string[] }>,
  ): Promise<{ rankings: Array<{ agent_id: string; confidence: number; reasoning: string }>; provider: string }> {
    const empty = { rankings: [], provider: 'none' };
    if (!this.isAvailable || agents.length === 0) return empty;

    try {
      const raw = await this.chat(
        MODEL_ANALYTICAL,
        'You are a ticket routing engine. Respond ONLY with valid JSON.',
        `Rank ALL agents for this ticket from best to worst fit.

Ticket: ${ticketTitle}
Description: ${ticketDesc}

Agents:
${agents.map((a) => `- id: ${a.id}, name: ${a.name}, skills: ${a.skills.join(', ')}`).join('\n')}

Respond with a JSON object:
{
  "rankings": [
    { "agent_id": "<id>", "confidence": <0-100 integer>, "reasoning": "<one sentence>" }
  ]
}

Include every agent. Sort descending by confidence.`,
        { json: true, maxTokens: 512 },
      );
      const parsed = this.parseJson(raw);
      const rankings: Array<{ agent_id: string; confidence: number; reasoning: string }> =
        Array.isArray(parsed?.rankings) ? parsed.rankings : [];
      return { rankings, provider: MODEL_ANALYTICAL };
    } catch (err) {
      this.logger.error(`suggestRoute failed: ${err.message}`);
      return { rankings: [], provider: MODEL_ANALYTICAL };
    }
  }

  // ── Embeddings ────────────────────────────────────────────────────────────

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.client) return [];

    try {
      const response = await this.client.embeddings.create({
        model: MODEL_EMBED,
        input: [{ content: [{ type: 'text', text: text.substring(0, 4000) }] }] as any,
        encoding_format: 'float',
      });
      return (response.data[0]?.embedding as number[]) ?? [];
    } catch (err) {
      this.logger.error(`generateEmbedding failed: ${err.message}`);
      return [];
    }
  }

  // ── Provider status ───────────────────────────────────────────────────────

  getProviderStatus() {
    return {
      available: this.isAvailable,
      provider: 'OpenRouter',
      models: {
        analytical: MODEL_ANALYTICAL,
        generative: MODEL_GENERATIVE,
        embedding: MODEL_EMBED,
      },
    };
  }
}
