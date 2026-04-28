import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AiService } from '../ai/ai.service';

// ─── Shared select ────────────────────────────────────────────────────────────
const ARTICLE_SELECT = {
  id: true,
  tenant_id: true,
  category_id: true,
  author_id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  tags: true,
  related_article_ids: true,
  helpful_count: true,
  view_count: true,
  status: true,
  published_at: true,
  created_at: true,
  updated_at: true,
  author: {
    select: { id: true, first_name: true, last_name: true, email: true, avatar_url: true },
  },
  category: {
    select: { id: true, name: true, slug: true },
  },
} as const;

// ─── DB row → API shape ───────────────────────────────────────────────────────
function formatArticle(a: any): Record<string, any> {
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    content: a.content ?? '',
    excerpt: a.excerpt ?? '',
    categoryId: a.category_id ?? null,
    category: a.category ?? null,
    tags: a.tags ?? [],
    authorId: a.author_id ?? null,
    author: a.author
      ? {
          id: a.author.id,
          displayName:
            [a.author.first_name, a.author.last_name].filter(Boolean).join(' ') || a.author.email,
          avatarUrl: a.author.avatar_url ?? null,
        }
      : null,
    isPublished: a.status === 'published',
    viewCount: a.view_count ?? 0,
    helpfulCount: a.helpful_count ?? 0,
    relatedArticleIds: a.related_article_ids ?? [],
    status: a.status,
    published_at: a.published_at,
    created_at: a.created_at,
    updated_at: a.updated_at,
  };
}

function toSlug(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ─── Minimum trigram similarity threshold (0–1) ───────────────────────────────
// 0.1 = permissive (catches more typos), 0.3 = strict
const TRGM_THRESHOLD = 0.1;

// ─── Normalise raw_score to 0–1 for consistent API responses ─────────────────
function normaliseScore(raw: number, max: number): number {
  return max > 0 ? Math.round((raw / max) * 100) / 100 : 0;
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  // Extract key paragraphs from markdown content (skips headings, picks first 3 meaty paragraphs)
  private extractKeySections(content: string): string {
    return content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 50 && !l.startsWith('#'))
      .slice(0, 3)
      .join('\n');
  }

  // Build high-quality embedding text: structured, meaning-first, not position-first
  private embeddingText(dto: { title: string; excerpt?: string | null; tags?: string[]; content?: string }): string {
    const sections = this.extractKeySections(dto.content ?? '');
    return [
      `Title: ${dto.title}`,
      dto.tags?.length ? `Tags: ${dto.tags.join(', ')}` : '',
      dto.excerpt ? `Summary: ${dto.excerpt}` : '',
      sections ? `Content:\n${sections}` : '',
    ].filter(Boolean).join('\n');
  }

  // Normalise a search query: lowercase, strip punctuation, collapse whitespace
  private normaliseQuery(q: string): string {
    return q.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Persist embedding with up to 2 retries — logs permanently if all attempts fail
  private async indexEmbedding(id: string, text: string): Promise<void> {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const raw = await this.aiService.generateEmbedding(text);
        if (!raw.length) return; // provider unavailable — skip silently
        // pgvector column is vector(2000); model returns 2048 dims — truncate to fit
        const embedding = raw.slice(0, 2000);
        const vec = `[${embedding.join(',')}]`;
        await this.prisma.$executeRawUnsafe(
          `UPDATE kb_articles SET content_vector = $1::vector WHERE id = $2::uuid`,
          vec,
          id,
        );
        return; // success
      } catch (err: any) {
        const isLast = attempt === MAX_ATTEMPTS;
        if (isLast) {
          this.logger.error(`Embedding indexing permanently failed for article ${id}: ${err.message}`);
        } else {
          this.logger.warn(`Embedding attempt ${attempt} failed for article ${id} — retrying…`);
          await new Promise((r) => setTimeout(r, attempt * 500));
        }
      }
    }
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    opts: {
      page?: number;
      limit?: number;
      status?: string;
      categoryId?: string;
      tags?: string[];
      search?: string;
    } = {},
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 25);

    const where: any = { tenant_id: tenantId };
    if (opts.status) where.status = opts.status;
    if (opts.categoryId) where.category_id = opts.categoryId;
    if (opts.tags?.length) where.tags = { hasSome: opts.tags };
    if (opts.search) {
      const s = opts.search;
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { excerpt: { contains: s, mode: 'insensitive' } },
        { content: { contains: s, mode: 'insensitive' } },
        { tags: { has: s } },
      ];
    }

    const [articles, total] = await Promise.all([
      this.prisma.kbArticle.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { view_count: 'desc' },
        select: ARTICLE_SELECT,
      }),
      this.prisma.kbArticle.count({ where }),
    ]);

    return {
      data: articles.map(formatArticle),
      page,
      page_size: limit,
      total,
      total_pages: Math.ceil(total / limit),
    };
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  //
  // Strategy (in order):
  //   1. Postgres full-text search (ts_rank_cd) — best relevance, language-aware
  //   2. Trigram similarity fall-through — catches typos when FTS finds nothing
  //   2.5. Vector similarity merge — semantic matches injected into candidates
  //   3. In-process re-ranking: layered score = FTS rank + tag bonus +
  //        log-scale popularity + log-scale helpfulness + vector similarity
  //   4. Highlights via ts_headline (DB-side) — accurate, KWIC-style snippets

  async search(tenantId: string, query: string, limit: number) {
    if (!query?.trim()) {
      const articles = await this.prisma.kbArticle.findMany({
        where: { tenant_id: tenantId, status: 'published' },
        orderBy: { view_count: 'desc' },
        take: limit,
        select: ARTICLE_SELECT,
      });
      return { data: articles.map((a) => ({ article: formatArticle(a), score: 1, highlights: [a.title] })) };
    }

    const normQuery = this.normaliseQuery(query);

    // ── Phase 1: Postgres full-text search ─────────────────────────────────
    const ftsResults = await this.fullTextSearch(tenantId, normQuery, limit * 4);

    let candidates = ftsResults;

    // ── Phase 2: trigram fall-through if FTS returns nothing ───────────────
    if (candidates.length === 0) {
      candidates = await this.trigramSearch(tenantId, normQuery, limit * 4);
    }

    // ── Phase 2.5: vector search merge ─────────────────────────────────────
    // Always run vector search and merge results — it adds semantic matches
    // that keyword/trigram miss (synonyms, paraphrases, concept overlap).
    const vectorResults = await this.vectorSearch(tenantId, normQuery, limit * 2);
    if (vectorResults.length > 0) {
      const seenIds = new Set(candidates.map((c: any) => c.id as string));
      for (const vr of vectorResults) {
        if (!seenIds.has(vr.id as string)) {
          candidates.push(vr);
          seenIds.add(vr.id as string);
        } else {
          // Boost existing candidate's trgm_sim with vector score so re-ranker sees it
          const existing = candidates.find((c: any) => c.id === vr.id);
          if (existing) existing.vec_sim = (vr as any).vec_sim ?? 0;
        }
      }
    }

    if (candidates.length === 0) return { data: [] };

    // ── Phase 3: in-process composite re-ranking ───────────────────────────
    const ranked = this.reRank(candidates, normQuery);
    const top = ranked.slice(0, limit);
    const maxScore = top[0]?.compositeScore ?? 1;

    // ── Phase 4: build final results with DB-side highlights ───────────────
    const ids = top.map((r) => r.id as string);
    const highlightMap = await this.fetchHighlights(ids, normQuery);

    return {
      data: top.map((r) => ({
        article: formatArticle(r),
        score: normaliseScore(r.compositeScore, maxScore),
        highlights: highlightMap.get(r.id as string) ?? [r.title as string],
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE SEARCH HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private async fullTextSearch(tenantId: string, query: string, take: number) {
    // plainto_tsquery is safe (handles arbitrary user input without syntax errors)
    // ts_rank_cd uses cover density — better for multi-word queries
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        a.id, a.tenant_id, a.category_id, a.author_id,
        a.title, a.slug, a.excerpt, a.content, a.tags,
        a.related_article_ids, a.helpful_count, a.view_count,
        a.status, a.published_at, a.created_at, a.updated_at,
        ts_rank_cd(a.search_vector, plainto_tsquery('english', ${query}), 32) AS fts_rank,
        0::float                                                               AS trgm_sim
      FROM kb_articles a
      WHERE
        a.tenant_id  = ${tenantId}::uuid
        AND a.status = 'published'
        AND a.search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY fts_rank DESC
      LIMIT ${take}
    `;
    return rows;
  }

  private async trigramSearch(tenantId: string, query: string, take: number) {
    // similarity() comes from the pg_trgm extension
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        a.id, a.tenant_id, a.category_id, a.author_id,
        a.title, a.slug, a.excerpt, a.content, a.tags,
        a.related_article_ids, a.helpful_count, a.view_count,
        a.status, a.published_at, a.created_at, a.updated_at,
        0::float                                                 AS fts_rank,
        GREATEST(
          similarity(a.title,   ${query}),
          similarity(a.excerpt, ${query})
        )                                                        AS trgm_sim
      FROM kb_articles a
      WHERE
        a.tenant_id = ${tenantId}::uuid
        AND a.status = 'published'
        AND (
          similarity(a.title,   ${query}) > ${TRGM_THRESHOLD}
          OR similarity(a.excerpt, ${query}) > ${TRGM_THRESHOLD}
        )
      ORDER BY trgm_sim DESC
      LIMIT ${take}
    `;
    return rows;
  }

  private async vectorSearch(tenantId: string, query: string, take: number) {
    const raw = await this.aiService.generateEmbedding(query);
    if (!raw.length) return [];

    // pgvector column is vector(2000); model returns 2048 dims — truncate to match
    const vec = `[${raw.slice(0, 2000).join(',')}]`;
    // cosine similarity = 1 - cosine distance (<=>)
    // Only return rows that have a stored embedding
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT a.id, a.tenant_id, a.category_id, a.author_id,
              a.title, a.slug, a.excerpt, a.content, a.tags,
              a.related_article_ids, a.helpful_count, a.view_count,
              a.status, a.published_at, a.created_at, a.updated_at,
              0::float                                  AS fts_rank,
              0::float                                  AS trgm_sim,
              1 - (a.content_vector <=> $1::vector)     AS vec_sim
       FROM kb_articles a
       WHERE a.tenant_id = $2::uuid
         AND a.status    = 'published'
         AND a.content_vector IS NOT NULL
       ORDER BY a.content_vector <=> $1::vector
       LIMIT $3`,
      vec,
      tenantId,
      take,
    );
    return rows;
  }

  private reRank(candidates: any[], query: string) {
    const terms = query.split(/\s+/).filter(Boolean); // already normalised by caller
    const fullPhrase = query;

    // ── Pre-compute per-signal max for normalisation ─────────────────────
    // ts_rank_cd is unbounded above 1 with cover-density; cap at observed max.
    const maxFts = candidates.reduce((m, a) => Math.max(m, parseFloat(a.fts_rank ?? 0)), 0) || 1;

    return candidates
      .map((a) => {
        const title   = (a.title   ?? '').toLowerCase();
        const excerpt = (a.excerpt ?? '').toLowerCase();
        const content = (a.content ?? '').toLowerCase();
        const tags    = ((a.tags ?? []) as string[]).map((t: string) => t.toLowerCase());

        // ── Normalised retrieval signals (each 0–1) ───────────────────────
        // Weights reflect signal reliability:
        //   FTS  0.40 — precise lexical match, language-aware stemming
        //   vec  0.35 — semantic / synonym coverage
        //   trgm 0.15 — typo tolerance
        //   pop  0.10 — trust / helpfulness signal
        const ftsNorm  = parseFloat(a.fts_rank ?? 0) / maxFts;
        const vecNorm  = Math.max(0, Math.min(1, parseFloat(a.vec_sim  ?? 0)));
        const trgmNorm = Math.max(0, Math.min(1, parseFloat(a.trgm_sim ?? 0)));

        // Log-scale popularity (dampens outliers; maxes at ~1 for 10k views)
        const popNorm = (
          Math.log10((Number(a.view_count)    || 0) + 1) * 0.5 +
          Math.log10((Number(a.helpful_count) || 0) + 1) * 0.7
        ) / 5; // normalise to ~0–1 range

        let score = ftsNorm * 0.40 + vecNorm * 0.35 + trgmNorm * 0.15 + popNorm * 0.10;

        // ── Keyword bonus (additive, kept small so it tips ties not dominates)
        let kwBonus = 0;
        for (const term of terms) {
          if (title.includes(term))                               kwBonus += 0.04;
          if (excerpt.includes(term))                             kwBonus += 0.02;
          if (content.includes(term))                             kwBonus += 0.01;
          if (tags.some((t: string) => t.includes(term)))         kwBonus += 0.03;
        }
        // Full-phrase exact match in title/excerpt is a strong signal
        if (terms.length > 1) {
          if (title.includes(fullPhrase))   kwBonus += 0.06;
          if (excerpt.includes(fullPhrase)) kwBonus += 0.03;
        }
        score += Math.min(kwBonus, 0.20); // cap bonus at 0.20 so it can't override signals

        return { ...a, compositeScore: score };
      })
      .sort((a, b) => b.compositeScore - a.compositeScore);
  }

  private async fetchHighlights(ids: string[], query: string): Promise<Map<string, string[]>> {
    if (!ids.length) return new Map();

    try {
      const rows = await this.prisma.$queryRaw<{ id: string; title_hl: string; body_hl: string }[]>`
        SELECT
          a.id,
          ts_headline(
            'english', a.title,
            plainto_tsquery('english', ${query}),
            'HighlightAll=true'
          ) AS title_hl,
          ts_headline(
            'english', coalesce(a.excerpt, left(a.content, 400)),
            plainto_tsquery('english', ${query}),
            'MaxWords=40, MinWords=15, MaxFragments=2'
          ) AS body_hl
        FROM kb_articles a
        WHERE a.id = ANY(${ids}::uuid[])
      `;

      const map = new Map<string, string[]>();
      for (const row of rows) {
        const highlights: string[] = [];
        if (row.title_hl) highlights.push(row.title_hl);
        if (row.body_hl && row.body_hl !== row.title_hl) highlights.push(row.body_hl);
        map.set(row.id, highlights);
      }
      return map;
    } catch {
      // Highlights are non-critical — fall back to empty so search still returns results
      return new Map();
    }
  }

  // ── Categories ────────────────────────────────────────────────────────────

  async getCategories(tenantId: string) {
    const categories = await this.prisma.kbCategory.findMany({
      where: { tenant_id: tenantId },
      include: { _count: { select: { articles: { where: { status: 'published' } } } } },
      orderBy: { name: 'asc' },
    });

    return {
      data: categories.map((c: typeof categories[number]) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
        articleCount: c._count.articles,
        parentId: c.parent_id ?? null,
      })),
    };
  }

  async createCategory(tenantId: string, dto: { name: string; description?: string; parent_id?: string }) {
    const slug = toSlug(dto.name);
    const category = await this.prisma.kbCategory.create({
      data: {
        tenant_id: tenantId,
        name: dto.name,
        slug,
        description: dto.description ?? null,
        parent_id: dto.parent_id ?? null,
      },
    });
    return { data: category };
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findOne(id: string, tenantId: string) {
    const article = await this.prisma.kbArticle.findFirst({
      where: { id, tenant_id: tenantId },
      select: ARTICLE_SELECT,
    });
    if (!article) throw new NotFoundException('Article not found');

    // Increment view count — fire and forget, don't block response
    this.prisma.kbArticle
      .update({ where: { id }, data: { view_count: { increment: 1 } } })
      .catch(() => {});

    return { data: { ...formatArticle(article), viewCount: (article.view_count ?? 0) + 1 } };
  }

  async create(tenantId: string, dto: any) {
    const isPublished = dto.is_published ?? dto.isPublished;
    const status = dto.status ?? (isPublished ? 'published' : 'draft');
    const slug   = toSlug(dto.title);

    const article = await this.prisma.kbArticle.create({
      data: {
        tenant_id:           tenantId,
        category_id:         dto.category_id ?? dto.categoryId ?? null,
        author_id:           dto.author_id   ?? null,
        title:               dto.title,
        slug,
        excerpt:             dto.excerpt ?? null,
        content:             dto.content,
        tags:                dto.tags ?? [],
        related_article_ids: dto.related_article_ids ?? dto.relatedArticleIds ?? [],
        status,
        published_at: status === 'published' ? new Date() : null,
        // search_vector is populated by the DB trigger on INSERT
      },
      select: ARTICLE_SELECT,
    });

    // Index embedding asynchronously — don't block the HTTP response
    this.indexEmbedding(article.id, this.embeddingText({ title: dto.title, excerpt: dto.excerpt, tags: dto.tags, content: dto.content }));

    return { data: formatArticle(article) };
  }

  async update(id: string, tenantId: string, dto: any) {
    const existing = await this.prisma.kbArticle.findFirst({
      where: { id, tenant_id: tenantId },
      select: { id: true, published_at: true, status: true, title: true },
    });
    if (!existing) throw new NotFoundException('Article not found');

    const updateData: any = {};
    if (dto.title       !== undefined) { updateData.title = dto.title; updateData.slug = toSlug(dto.title); }
    if (dto.content     !== undefined) updateData.content     = dto.content;
    if (dto.excerpt     !== undefined) updateData.excerpt     = dto.excerpt;
    const categoryId = dto.category_id ?? dto.categoryId;
    if (categoryId !== undefined) updateData.category_id = categoryId;
    if (dto.author_id   !== undefined) updateData.author_id   = dto.author_id;
    if (dto.tags        !== undefined) updateData.tags        = dto.tags;
    const relatedIds = dto.related_article_ids ?? dto.relatedArticleIds;
    if (relatedIds !== undefined) updateData.related_article_ids = relatedIds;

    const isPublished = dto.is_published ?? dto.isPublished;
    const newStatus = dto.status ?? (isPublished !== undefined ? (isPublished ? 'published' : 'draft') : undefined);
    if (newStatus !== undefined) {
      updateData.status = newStatus;
      if (newStatus === 'published' && !existing.published_at) {
        updateData.published_at = new Date();
      }
    }

    const updated = await this.prisma.kbArticle.update({
      where: { id },
      data: updateData,
      // search_vector updated automatically by the DB trigger on UPDATE
      select: ARTICLE_SELECT,
    });

    // Re-index embedding if any content field changed
    const contentChanged = ['title', 'excerpt', 'tags', 'content'].some((f) => dto[f] !== undefined);
    if (contentChanged) {
      this.indexEmbedding(
        id,
        this.embeddingText({
          title:   updated.title,
          excerpt: updated.excerpt,
          tags:    updated.tags as string[],
          content: updated.content,
        }),
      );
    }

    return { data: formatArticle(updated) };
  }

  async remove(id: string, tenantId: string) {
    const article = await this.prisma.kbArticle.findFirst({
      where: { id, tenant_id: tenantId },
      select: { id: true },
    });
    if (!article) throw new NotFoundException('Article not found');
    await this.prisma.kbArticle.delete({ where: { id } });
    return { success: true, message: 'Article deleted' };
  }

  async vote(id: string, tenantId: string, helpful: boolean) {
    const article = await this.prisma.kbArticle.findFirst({
      where: { id, tenant_id: tenantId },
      select: { id: true },
    });
    if (!article) throw new NotFoundException('Article not found');

    const updated = await this.prisma.kbArticle.update({
      where: { id },
      data: { helpful_count: helpful ? { increment: 1 } : { decrement: 1 } },
      select: { helpful_count: true },
    });
    return { data: { helpfulCount: updated.helpful_count } };
  }
}
