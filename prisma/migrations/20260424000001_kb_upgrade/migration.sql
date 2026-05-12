-- Enable pg_trgm for typo-tolerant (trigram) search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────────
-- KB CATEGORIES
-- ─────────────────────────────────────────────
CREATE TABLE kb_categories (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL,
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL,
  description TEXT,
  parent_id   UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kb_categories_pkey PRIMARY KEY (id),
  CONSTRAINT kb_categories_tenant_slug_key UNIQUE (tenant_id, slug),
  CONSTRAINT kb_categories_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT kb_categories_parent_fk FOREIGN KEY (parent_id) REFERENCES kb_categories(id) ON DELETE SET NULL
);

CREATE INDEX kb_categories_tenant_idx ON kb_categories(tenant_id);

-- ─────────────────────────────────────────────
-- ALTER KB ARTICLES — add missing columns
-- ─────────────────────────────────────────────
ALTER TABLE kb_articles
  ADD COLUMN IF NOT EXISTS slug                TEXT,
  ADD COLUMN IF NOT EXISTS excerpt             TEXT,
  ADD COLUMN IF NOT EXISTS author_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags                TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS related_article_ids UUID[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS search_vector       TSVECTOR;

-- Back-fill slug from title for existing rows
UPDATE kb_articles
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(title, '\s+', '-', 'g'), '[^a-z0-9\-]', '', 'g'))
WHERE slug IS NULL OR slug = '';

-- Make slug NOT NULL + unique per tenant after back-fill
ALTER TABLE kb_articles ALTER COLUMN slug SET NOT NULL;
ALTER TABLE kb_articles ADD CONSTRAINT kb_articles_tenant_slug_key UNIQUE (tenant_id, slug);

-- Add FK to kb_categories (category_id was already UUID nullable)
ALTER TABLE kb_articles
  ADD CONSTRAINT kb_articles_category_fk
    FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────

-- GIN index for fast full-text search on the stored tsvector
CREATE INDEX IF NOT EXISTS kb_articles_search_vector_idx
  ON kb_articles USING GIN (search_vector);

-- GIN index for fast @> / ANY tag queries
CREATE INDEX IF NOT EXISTS kb_articles_tags_idx
  ON kb_articles USING GIN (tags);

-- Trigram indexes for typo-tolerant LIKE/similarity queries
CREATE INDEX IF NOT EXISTS kb_articles_title_trgm_idx
  ON kb_articles USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS kb_articles_excerpt_trgm_idx
  ON kb_articles USING GIN (excerpt gin_trgm_ops);

CREATE INDEX IF NOT EXISTS kb_articles_content_trgm_idx
  ON kb_articles USING GIN (content gin_trgm_ops);

-- Composite for listing by tenant + status
CREATE INDEX IF NOT EXISTS kb_articles_tenant_category_idx
  ON kb_articles (tenant_id, category_id);

-- pgvector supports max 2000 dimensions for indexed columns.
-- nvidia/llama-nemotron-embed-vl-1b-v2 produces 2048-dim vectors;
-- we store the first 2000 dims (truncation cost < 2.5%, negligible for retrieval).
ALTER TABLE kb_articles
  ALTER COLUMN content_vector TYPE vector(2000)
  USING content_vector::vector(2000);

-- HNSW index for fast approximate nearest-neighbour vector search (cosine distance)
-- m=16 ef_construction=64 are solid defaults for KBs up to ~50k articles
CREATE INDEX IF NOT EXISTS kb_articles_content_vector_idx
  ON kb_articles USING hnsw (content_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ─────────────────────────────────────────────
-- SEARCH VECTOR — trigger to keep it current
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION kb_articles_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')),   'A') ||
    setweight(to_tsvector('english', coalesce(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(
      array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kb_articles_search_vector_trigger ON kb_articles;
CREATE TRIGGER kb_articles_search_vector_trigger
  BEFORE INSERT OR UPDATE ON kb_articles
  FOR EACH ROW EXECUTE FUNCTION kb_articles_search_vector_update();

-- Back-fill search_vector for any existing rows
UPDATE kb_articles SET title = title;  -- fires the trigger on every row

-- ─────────────────────────────────────────────
-- updated_at trigger for kb_categories
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kb_categories_updated_at
  BEFORE UPDATE ON kb_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
