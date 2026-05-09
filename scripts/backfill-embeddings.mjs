/**
 * Backfill content_vector for all KB articles that have no embedding yet.
 * Run once: node scripts/backfill-embeddings.mjs
 */
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const MODEL_EMBED = 'nvidia/llama-nemotron-embed-vl-1b-v2:free';

const prisma = new PrismaClient();
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.AI_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://3sc-platform.railway.app',
    'X-Title': '3SC Platform',
  },
});

// Mirror the same logic as KnowledgeBaseService.embeddingText()
function extractKeySections(content) {
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 50 && !l.startsWith('#'))
    .slice(0, 3)
    .join('\n');
}

function embeddingText(article) {
  const sections = extractKeySections(article.content ?? '');
  return [
    `Title: ${article.title}`,
    article.tags?.length ? `Tags: ${article.tags.join(', ')}` : '',
    article.excerpt ? `Summary: ${article.excerpt}` : '',
    sections ? `Content:\n${sections}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: MODEL_EMBED,
    input: [{ content: [{ type: 'text', text: text.substring(0, 4000) }] }],
    encoding_format: 'float',
  });
  return response.data[0]?.embedding ?? [];
}

async function main() {
  const articles = await prisma.kbArticle.findMany({
    select: { id: true, title: true, excerpt: true, content: true, tags: true },
  });

  // Filter to only those without embeddings
  const rows = await prisma.$queryRaw`
    SELECT id FROM kb_articles WHERE content_vector IS NULL
  `;
  const needsEmbedding = new Set(rows.map((r) => r.id));
  const targets = articles.filter((a) => needsEmbedding.has(a.id));

  console.log(`\n📚 ${articles.length} total articles — ${targets.length} need embeddings\n`);

  let ok = 0;
  let failed = 0;

  for (const article of targets) {
    const text = embeddingText(article);
    process.stdout.write(`  ⏳ "${article.title}" … `);

    let embedding = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        embedding = await generateEmbedding(text);
        break;
      } catch (err) {
        if (attempt === 3) {
          process.stdout.write(`❌ FAILED (${err.message})\n`);
          failed++;
          embedding = null;
          break;
        }
        await new Promise((r) => setTimeout(r, attempt * 600));
      }
    }

    if (!embedding?.length) continue;

    // pgvector column is vector(2000); model returns 2048 dims — truncate to fit
    const truncated = embedding.slice(0, 2000);
    const vec = `[${truncated.join(',')}]`;
    await prisma.$executeRawUnsafe(
      `UPDATE kb_articles SET content_vector = $1::vector WHERE id = $2::uuid`,
      vec,
      article.id,
    );
    process.stdout.write(`✅ (${truncated.length}d)\n`);
    ok++;

    // Respect free-tier rate limits — 200ms between calls
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\n✅ Done — ${ok} indexed, ${failed} failed\n`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
