import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function seededUuid(prefix: string, seed: string): string {
  const input = `${prefix}:${seed}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  const rng = (offset: number) => {
    let v = Math.abs((hash + offset) * 0x9e3779b9 | 0);
    return v.toString(16).padStart(8, '0');
  };
  const p1 = rng(1);
  const p2 = rng(2);
  const p3 = rng(3);
  const p4 = rng(4);
  const p5 = rng(5);
  const p6 = rng(6);
  const variant = ['8', '9', 'a', 'b'][Math.abs(hash) % 4];
  return `${p1}-${p2.slice(0, 4)}-4${p3.slice(0, 3)}-${variant}${p4.slice(0, 3)}-${p5}${p6.slice(0, 4)}`;
}

const TENANT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const THEMES = [
  { theme: 'Dashboard loading slow', sentiment: 'negative' as const, weight: 1.2 },
  { theme: 'Need CSV/export feature', sentiment: 'neutral' as const, weight: 1.0 },
  { theme: 'UI navigation confusing', sentiment: 'negative' as const, weight: 0.9 },
  { theme: 'Excellent support & communication', sentiment: 'positive' as const, weight: 1.1 },
  { theme: 'Mobile app crashes', sentiment: 'negative' as const, weight: 0.8 },
  { theme: 'Billing page incorrect', sentiment: 'negative' as const, weight: 0.7 },
  { theme: 'Search results irrelevant', sentiment: 'neutral' as const, weight: 0.6 },
  { theme: 'Great onboarding experience', sentiment: 'positive' as const, weight: 0.8 },
  { theme: 'API documentation unclear', sentiment: 'neutral' as const, weight: 0.7 },
  { theme: 'Fast resolution time', sentiment: 'positive' as const, weight: 0.9 },
];

const MODULES = ['Ticketing', 'Analytics', 'Billing', 'Mobile', 'API', 'Onboarding', 'Settings'];
const SEGMENTS = ['Enterprise', 'Business', 'Pro', 'Starter'];

function randomDate(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

function weightedRandom<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

async function main() {
  console.log('🌱 Seeding CSAT/NPS feedback responses…');

  await prisma.feedbackResponse.deleteMany({
    where: { tenant_id: TENANT_ID },
  });

  const responses: any[] = [];
  const count = 500;

  for (let i = 0; i < count; i++) {
    const themeObj = weightedRandom(THEMES, THEMES.map((t) => t.weight));
    const csatBase = themeObj.sentiment === 'positive' ? 4.5 : themeObj.sentiment === 'negative' ? 2.8 : 3.5;
    const csatScore = Math.max(1, Math.min(5, Math.round(csatBase + (Math.random() - 0.5) * 2)));
    const npsBase = themeObj.sentiment === 'positive' ? 8.5 : themeObj.sentiment === 'negative' ? 4.5 : 7.0;
    const npsScore = Math.max(0, Math.min(10, Math.round(npsBase + (Math.random() - 0.5) * 4)));

    responses.push({
      id: seededUuid('feedback', `FBK-${i.toString().padStart(4, '0')}`),
      tenant_id: TENANT_ID,
      project_id: null,
      csat_score: csatScore,
      nps_score: npsScore,
      sentiment: themeObj.sentiment,
      theme: themeObj.theme,
      module: MODULES[Math.floor(Math.random() * MODULES.length)],
      customer_segment: SEGMENTS[Math.floor(Math.random() * SEGMENTS.length)],
      is_flagged: themeObj.sentiment === 'negative' && Math.random() > 0.6,
      created_at: randomDate(90),
    });
  }

  // Insert in batches of 100
  for (let i = 0; i < responses.length; i += 100) {
    const batch = responses.slice(i, i + 100);
    await prisma.feedbackResponse.createMany({ data: batch });
  }

  console.log(`✅ Created ${responses.length} feedback responses`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
