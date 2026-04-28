import { PrismaClient, TicketStatus, TicketPriority, TicketCategory, UserRole, OverrideType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ─── Helper: deterministic pseudo-UUID from a seed string ──────────────────
function seededUuid(prefix: string, seed: string): string {
  // keeps the existing hard-coded UUIDs intact while giving new ones a stable mapping
  const map: Record<string, string> = {
    'ORG-001': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'ORG-002': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'ORG-003': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'ORG-004': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
    'ORG-006': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',
    'USR-001': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01',
    'USR-002': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02',
    'USR-003': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03',
    'USR-004': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04',
    'USR-005': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b05',
    'USR-006': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b06',
    'USR-008': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b08',
    'USR-101': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
    'USR-102': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12',
    'USR-103': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13',
    'USR-104': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14',
    'TKT-001': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01',
    'TKT-002': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c02',
    'TKT-003': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c03',
    'TKT-004': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c04',
    'TKT-005': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c05',
    'TKT-006': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c06',
    'TKT-016': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c16',
    'TKT-018': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c18',
    'TKT-020': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c20',
    // PRJ-006 project tickets
    'TKT-051': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c51',
    'TKT-052': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c52',
    'TKT-053': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c53',
    'TKT-054': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c54',
    'TKT-055': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c55',
    'TKT-056': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c56',
    'TKT-057': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c57',
    'TKT-058': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c58',
    'PRJ-006': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380d06',
  };
  if (map[seed]) return map[seed];

  // Fallback: produce a valid v4-looking UUID deterministically from the seed.
  // UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx  (y = 8|9|a|b)
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

  return `${p1}-${p2.slice(0,4)}-4${p3.slice(0,3)}-${variant}${p4.slice(0,3)}-${p5}${p6.slice(0,4)}`;
}

function t(key: string) {
  const tenantMap: Record<string, string> = {
    'ORG-001': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'ORG-002': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'ORG-003': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    'ORG-004': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
    'ORG-005': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16',
    'ORG-006': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',
    'ORG-007': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17',
  };
  return tenantMap[key]!;
}

function u(key: string) {
  const userMap: Record<string, string> = {
    'USR-001': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01',
    'USR-002': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02',
    'USR-003': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b03',
    'USR-004': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b04',
    'USR-005': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b05',
    'USR-006': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b06',
    'USR-007': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b07',
    'USR-008': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b08',
    'USR-101': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
    'USR-102': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12',
    'USR-103': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b13',
    'USR-104': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b14',
  };
  return userMap[key]!;
}

async function main() {
  console.log('🌱 Seeding database…');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // ─── Clean slate (respect foreign-key order) ───────────────────────────────
  await prisma.permissionOverride.deleteMany();
  await prisma.workload.deleteMany();
  await prisma.userSkill.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.routingRule.deleteMany();
  await prisma.roadmapFeature.deleteMany();
  await prisma.onboardingItem.deleteMany();
  await prisma.deliveryItem.deleteMany();
  await prisma.project.deleteMany();
  await prisma.kbArticle.deleteMany();
  await prisma.kbCategory.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.slaPolicy.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. TENANTS
  // ═══════════════════════════════════════════════════════════════════════════
  const tenants = await prisma.$transaction([
    prisma.tenant.create({
      data: { id: t('ORG-001'), slug: '3sc-internal', name: '3SC Internal', plan: 'Enterprise', settings: {}, branding: {} },
    }),
    prisma.tenant.create({
      data: { id: t('ORG-002'), slug: 'acme-corp', name: 'Acme Corporation', plan: 'Business', settings: {}, branding: {} },
    }),
    prisma.tenant.create({
      data: { id: t('ORG-003'), slug: 'techwave-io', name: 'TechWave IO', plan: 'Pro', settings: {}, branding: {} },
    }),
    prisma.tenant.create({
      data: { id: t('ORG-004'), slug: 'global-finance-group', name: 'Global Finance Group', plan: 'Enterprise', settings: {}, branding: {} },
    }),
    prisma.tenant.create({
      data: { id: t('ORG-005'), slug: 'nomad-retail', name: 'Nomad Retail Ltd', plan: 'Starter', settings: {}, branding: {} },
    }),
    prisma.tenant.create({
      data: { id: t('ORG-006'), slug: 'apex-logistics', name: 'Apex Logistics', plan: 'Business', settings: {}, branding: {} },
    }),
    prisma.tenant.create({
      data: { id: t('ORG-007'), slug: 'sunrise-healthcare', name: 'Sunrise Healthcare', plan: 'Enterprise', settings: {}, branding: {} },
    }),
  ]);
  console.log(`✅ Created ${tenants.length} tenants`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. USERS
  // ═══════════════════════════════════════════════════════════════════════════
  const usersData = [
    { id: u('USR-001'), tenant_id: t('ORG-001'), email: 'alex.morgan@3sc.com', password_hash: passwordHash, role: UserRole.ADMIN, first_name: 'Alex', last_name: 'Morgan', avatar_url: 'https://i.pravatar.cc/150?u=alex', preferences: { theme: 'light', notifications: true }, last_active_at: new Date('2026-04-16T08:14:00Z') },
    { id: u('USR-002'), tenant_id: t('ORG-001'), email: 'priya.sharma@3sc.com', password_hash: passwordHash, role: UserRole.LEAD, first_name: 'Priya', last_name: 'Sharma', avatar_url: 'https://i.pravatar.cc/150?u=priya', preferences: {}, last_active_at: new Date('2026-04-16T07:45:00Z') },
    { id: u('USR-003'), tenant_id: t('ORG-001'), email: 'james.okafor@3sc.com', password_hash: passwordHash, role: UserRole.AGENT, first_name: 'James', last_name: 'Okafor', avatar_url: 'https://i.pravatar.cc/150?u=james', preferences: {}, last_active_at: new Date('2026-04-16T09:01:00Z') },
    { id: u('USR-004'), tenant_id: t('ORG-001'), email: 'sara.chen@3sc.com', password_hash: passwordHash, role: UserRole.AGENT, first_name: 'Sara', last_name: 'Chen', avatar_url: 'https://i.pravatar.cc/150?u=sara', preferences: {}, last_active_at: new Date('2026-04-15T17:22:00Z') },
    { id: u('USR-005'), tenant_id: t('ORG-001'), email: 'michael.reyes@3sc.com', password_hash: passwordHash, role: UserRole.AGENT, first_name: 'Michael', last_name: 'Reyes', avatar_url: 'https://i.pravatar.cc/150?u=michael', preferences: {}, last_active_at: new Date('2026-04-14T13:55:00Z') },
    { id: u('USR-006'), tenant_id: t('ORG-001'), email: 'nina.patel@3sc.com', password_hash: passwordHash, role: UserRole.LEAD, first_name: 'Nina', last_name: 'Patel', avatar_url: 'https://i.pravatar.cc/150?u=nina', preferences: {}, last_active_at: new Date('2026-04-16T06:30:00Z') },
    { id: u('USR-007'), tenant_id: t('ORG-001'), email: 'tom.baker@3sc.com', password_hash: passwordHash, role: UserRole.AGENT, first_name: 'Tom', last_name: 'Baker', avatar_url: 'https://i.pravatar.cc/150?u=tom', preferences: {}, last_active_at: new Date('2026-01-10T11:00:00Z') },
    { id: u('USR-008'), tenant_id: t('ORG-001'), email: 'yuki.tanaka@3sc.com', password_hash: passwordHash, role: UserRole.AGENT, first_name: 'Yuki', last_name: 'Tanaka', avatar_url: 'https://i.pravatar.cc/150?u=yuki', preferences: {}, last_active_at: new Date('2026-04-16T08:55:00Z') },
    { id: u('USR-101'), tenant_id: t('ORG-002'), email: 'david.wilson@acmecorp.com', password_hash: passwordHash, role: UserRole.CLIENT_ADMIN, first_name: 'David', last_name: 'Wilson', avatar_url: 'https://i.pravatar.cc/150?u=david', preferences: {}, last_active_at: new Date('2026-04-16T07:12:00Z') },
    { id: u('USR-102'), tenant_id: t('ORG-002'), email: 'lucy.nguyen@acmecorp.com', password_hash: passwordHash, role: UserRole.CLIENT_USER, first_name: 'Lucy', last_name: 'Nguyen', avatar_url: 'https://i.pravatar.cc/150?u=lucy', preferences: {}, last_active_at: new Date('2026-04-14T15:30:00Z') },
    { id: u('USR-103'), tenant_id: t('ORG-003'), email: 'ben.harper@techwave.io', password_hash: passwordHash, role: UserRole.CLIENT_ADMIN, first_name: 'Ben', last_name: 'Harper', avatar_url: 'https://i.pravatar.cc/150?u=ben', preferences: {}, last_active_at: new Date('2026-04-15T09:45:00Z') },
    { id: u('USR-104'), tenant_id: t('ORG-004'), email: 'rachel.kim@globalfinance.com', password_hash: passwordHash, role: UserRole.CLIENT_ADMIN, first_name: 'Rachel', last_name: 'Kim', avatar_url: 'https://i.pravatar.cc/150?u=rachel', preferences: {}, last_active_at: new Date('2026-04-13T14:20:00Z') },
  ];

  for (const user of usersData) {
    await prisma.user.create({ data: user as any });
  }
  console.log(`✅ Created ${usersData.length} users`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. SKILLS
  // ═══════════════════════════════════════════════════════════════════════════
  const skillsData = [
    { id: seededUuid('skill', 'SKL-001'), tenant_id: t('ORG-001'), name: 'React', category: 'TECHNICAL', description: 'React.js frontend development' },
    { id: seededUuid('skill', 'SKL-002'), tenant_id: t('ORG-001'), name: 'Node.js', category: 'TECHNICAL', description: 'Node.js backend development' },
    { id: seededUuid('skill', 'SKL-003'), tenant_id: t('ORG-001'), name: 'TypeScript', category: 'TECHNICAL', description: 'TypeScript / static typing' },
    { id: seededUuid('skill', 'SKL-004'), tenant_id: t('ORG-001'), name: 'AWS', category: 'TECHNICAL', description: 'Amazon Web Services infrastructure' },
    { id: seededUuid('skill', 'SKL-005'), tenant_id: t('ORG-001'), name: 'SQL / PostgreSQL', category: 'TECHNICAL', description: 'Relational database queries and admin' },
    { id: seededUuid('skill', 'SKL-006'), tenant_id: t('ORG-001'), name: 'API Integration', category: 'TECHNICAL', description: 'REST and webhook integration debugging' },
    { id: seededUuid('skill', 'SKL-007'), tenant_id: t('ORG-001'), name: 'Docker / K8s', category: 'TECHNICAL', description: 'Container deployment and orchestration' },
    { id: seededUuid('skill', 'SKL-008'), tenant_id: t('ORG-001'), name: 'Python', category: 'TECHNICAL', description: 'Python scripting and data processing' },
    { id: seededUuid('skill', 'SKL-009'), tenant_id: t('ORG-001'), name: 'Billing & Payments', category: 'DOMAIN', description: 'Invoicing, payment disputes, subscription issues' },
    { id: seededUuid('skill', 'SKL-010'), tenant_id: t('ORG-001'), name: 'Onboarding', category: 'DOMAIN', description: 'Client onboarding process and setup' },
    { id: seededUuid('skill', 'SKL-011'), tenant_id: t('ORG-001'), name: 'SLA Management', category: 'DOMAIN', description: 'Service level agreement policies and escalation' },
    { id: seededUuid('skill', 'SKL-012'), tenant_id: t('ORG-001'), name: 'Compliance & GDPR', category: 'DOMAIN', description: 'Data protection, erasure requests, audit' },
    { id: seededUuid('skill', 'SKL-013'), tenant_id: t('ORG-001'), name: 'Project Delivery', category: 'DOMAIN', description: 'Delivery board, milestone tracking, status reports' },
    { id: seededUuid('skill', 'SKL-014'), tenant_id: t('ORG-001'), name: 'Salesforce', category: 'DOMAIN', description: 'Salesforce CRM integration support' },
    { id: seededUuid('skill', 'SKL-015'), tenant_id: t('ORG-001'), name: 'Meridian Platform', category: 'PRODUCT', description: 'Deep knowledge of the Meridian internal platform' },
    { id: seededUuid('skill', 'SKL-016'), tenant_id: t('ORG-001'), name: 'KB Authoring', category: 'PRODUCT', description: 'Writing and maintaining knowledge base articles' },
    { id: seededUuid('skill', 'SKL-017'), tenant_id: t('ORG-001'), name: 'French', category: 'LANGUAGE', description: 'Native or professional French' },
    { id: seededUuid('skill', 'SKL-018'), tenant_id: t('ORG-001'), name: 'German', category: 'LANGUAGE', description: 'Native or professional German' },
    { id: seededUuid('skill', 'SKL-019'), tenant_id: t('ORG-001'), name: 'Spanish', category: 'LANGUAGE', description: 'Native or professional Spanish' },
  ];

  for (const skill of skillsData) {
    await prisma.skill.create({ data: skill });
  }
  console.log(`✅ Created ${skillsData.length} skills`);

  const s = (id: string) => seededUuid('skill', id);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. USER SKILLS
  // ═══════════════════════════════════════════════════════════════════════════
  const userSkillsData = [
    { user_id: u('USR-001'), skill_id: s('SKL-015'), proficiency: 5 },
    { user_id: u('USR-001'), skill_id: s('SKL-012'), proficiency: 3 },
    { user_id: u('USR-001'), skill_id: s('SKL-003'), proficiency: 5 },
    { user_id: u('USR-002'), skill_id: s('SKL-011'), proficiency: 5 },
    { user_id: u('USR-002'), skill_id: s('SKL-013'), proficiency: 5 },
    { user_id: u('USR-002'), skill_id: s('SKL-010'), proficiency: 3 },
    { user_id: u('USR-002'), skill_id: s('SKL-015'), proficiency: 5 },
    { user_id: u('USR-003'), skill_id: s('SKL-001'), proficiency: 5 },
    { user_id: u('USR-003'), skill_id: s('SKL-002'), proficiency: 5 },
    { user_id: u('USR-003'), skill_id: s('SKL-003'), proficiency: 5 },
    { user_id: u('USR-003'), skill_id: s('SKL-006'), proficiency: 3 },
    { user_id: u('USR-003'), skill_id: s('SKL-004'), proficiency: 3 },
    { user_id: u('USR-004'), skill_id: s('SKL-009'), proficiency: 5 },
    { user_id: u('USR-004'), skill_id: s('SKL-011'), proficiency: 3 },
    { user_id: u('USR-004'), skill_id: s('SKL-015'), proficiency: 3 },
    { user_id: u('USR-004'), skill_id: s('SKL-017'), proficiency: 3 },
    { user_id: u('USR-005'), skill_id: s('SKL-005'), proficiency: 5 },
    { user_id: u('USR-005'), skill_id: s('SKL-008'), proficiency: 5 },
    { user_id: u('USR-005'), skill_id: s('SKL-004'), proficiency: 5 },
    { user_id: u('USR-005'), skill_id: s('SKL-007'), proficiency: 3 },
    { user_id: u('USR-005'), skill_id: s('SKL-006'), proficiency: 3 },
    { user_id: u('USR-006'), skill_id: s('SKL-013'), proficiency: 5 },
    { user_id: u('USR-006'), skill_id: s('SKL-010'), proficiency: 5 },
    { user_id: u('USR-006'), skill_id: s('SKL-014'), proficiency: 3 },
    { user_id: u('USR-006'), skill_id: s('SKL-011'), proficiency: 3 },
    { user_id: u('USR-007'), skill_id: s('SKL-015'), proficiency: 3 },
    { user_id: u('USR-007'), skill_id: s('SKL-009'), proficiency: 3 },
    { user_id: u('USR-008'), skill_id: s('SKL-010'), proficiency: 5 },
    { user_id: u('USR-008'), skill_id: s('SKL-013'), proficiency: 5 },
    { user_id: u('USR-008'), skill_id: s('SKL-016'), proficiency: 3 },
    { user_id: u('USR-008'), skill_id: s('SKL-018'), proficiency: 3 },
  ];

  for (const us of userSkillsData) {
    await prisma.userSkill.create({ data: us });
  }
  console.log(`✅ Created ${userSkillsData.length} user skills`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. WORKLOADS
  // ═══════════════════════════════════════════════════════════════════════════
  const workloadsData = [
    { user_id: u('USR-001'), active_tickets: 3, max_capacity: 30, availability: 'available' },
    { user_id: u('USR-002'), active_tickets: 8, max_capacity: 25, availability: 'available' },
    { user_id: u('USR-003'), active_tickets: 14, max_capacity: 20, availability: 'busy' },
    { user_id: u('USR-004'), active_tickets: 6, max_capacity: 20, availability: 'available' },
    { user_id: u('USR-005'), active_tickets: 18, max_capacity: 20, availability: 'busy' },
    { user_id: u('USR-006'), active_tickets: 5, max_capacity: 25, availability: 'available' },
    { user_id: u('USR-007'), active_tickets: 0, max_capacity: 20, availability: 'offline' },
    { user_id: u('USR-008'), active_tickets: 11, max_capacity: 20, availability: 'available' },
  ];

  for (const wl of workloadsData) {
    await prisma.workload.create({ data: wl });
  }
  console.log(`✅ Created ${workloadsData.length} workloads`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. SLA POLICIES
  // ═══════════════════════════════════════════════════════════════════════════
  const slaPoliciesData = [
    { id: seededUuid('sla', 'SLA-001'), tenant_id: t('ORG-001'), name: 'Enterprise Critical', priority: TicketPriority.URGENT, first_response_minutes: 15, resolution_minutes: 240, business_hours: { mon: '09:00-18:00', tue: '09:00-18:00', wed: '09:00-18:00', thu: '09:00-18:00', fri: '09:00-18:00' }, timezone: 'UTC' },
    { id: seededUuid('sla', 'SLA-002'), tenant_id: t('ORG-001'), name: 'Enterprise High', priority: TicketPriority.HIGH, first_response_minutes: 60, resolution_minutes: 1440, business_hours: { mon: '09:00-18:00', tue: '09:00-18:00', wed: '09:00-18:00', thu: '09:00-18:00', fri: '09:00-18:00' }, timezone: 'UTC' },
    { id: seededUuid('sla', 'SLA-003'), tenant_id: t('ORG-001'), name: 'Enterprise Medium', priority: TicketPriority.MEDIUM, first_response_minutes: 240, resolution_minutes: 2880, business_hours: { mon: '09:00-18:00', tue: '09:00-18:00', wed: '09:00-18:00', thu: '09:00-18:00', fri: '09:00-18:00' }, timezone: 'UTC' },
    { id: seededUuid('sla', 'SLA-004'), tenant_id: t('ORG-001'), name: 'Enterprise Low', priority: TicketPriority.LOW, first_response_minutes: 480, resolution_minutes: 5760, business_hours: { mon: '09:00-18:00', tue: '09:00-18:00', wed: '09:00-18:00', thu: '09:00-18:00', fri: '09:00-18:00' }, timezone: 'UTC' },
    { id: seededUuid('sla', 'SLA-005'), tenant_id: t('ORG-002'), name: 'Business Standard', priority: TicketPriority.HIGH, first_response_minutes: 120, resolution_minutes: 2880, business_hours: { mon: '09:00-17:00', tue: '09:00-17:00', wed: '09:00-17:00', thu: '09:00-17:00', fri: '09:00-17:00' }, timezone: 'America/New_York' },
  ];

  for (const sla of slaPoliciesData) {
    await prisma.slaPolicy.create({ data: sla as any });
  }
  console.log(`✅ Created ${slaPoliciesData.length} SLA policies`);


  // ═══════════════════════════════════════════════════════════════════════════
  // 7. PROJECTS + TICKETS  (projects must be inserted before tickets due to FK)
  // ═══════════════════════════════════════════════════════════════════════════
  const projectsData = [
    {
      id: seededUuid('project', 'PRJ-001'), tenant_id: t('ORG-002'), status: 'active', client_id: u('USR-101'), health_score: 62,
      name: 'Customer Support Platform',
      description: 'Building a scalable customer support system with AI-powered ticket routing and analytics dashboard.',
      metadata: {
        scope: 'Deliver a multi-tenant SaaS support platform including ticket management, SLA enforcement, AI-assisted triage, and a customer-facing portal.',
        ticketCount: 42, openTicketCount: 8, resolvedThisWeek: 3,
        milestones: [
          { id: 'M-001', title: 'Kick-off & Requirements', isCompleted: true,  completedAt: new Date('2025-10-25'), dueDate: new Date('2025-10-30'), estimatedTickets: 5,  openTickets: 0 },
          { id: 'M-002', title: 'UI Design & Prototyping', isCompleted: true,  completedAt: new Date('2025-11-15'), dueDate: new Date('2025-11-20'), estimatedTickets: 12, openTickets: 0 },
          { id: 'M-003', title: 'API Development',         isCompleted: true,  completedAt: new Date('2026-02-10'), dueDate: new Date('2026-02-15'), estimatedTickets: 18, openTickets: 0 },
          { id: 'M-004', title: 'AI Integration',          isCompleted: false, completedAt: null,                  dueDate: new Date('2026-05-01'), estimatedTickets: 14, openTickets: 6 },
          { id: 'M-005', title: 'Go-Live',                 isCompleted: false, completedAt: null,                  dueDate: new Date('2026-06-15'), estimatedTickets: 8,  openTickets: 2 },
        ],
      },
      created_at: new Date('2025-10-20T09:00:00Z'), updated_at: new Date('2026-04-15T11:30:00Z'),
    },
    {
      id: seededUuid('project', 'PRJ-002'), tenant_id: t('ORG-003'), status: 'planning', client_id: u('USR-103'), health_score: 88,
      name: 'Mobile App Revamp',
      description: 'Redesigning the mobile application with improved UX and performance optimizations for iOS and Android.',
      metadata: {
        scope: 'Redesign and rebuild the iOS and Android mobile apps using React Native.',
        ticketCount: 15, openTicketCount: 4, resolvedThisWeek: 1,
        milestones: [
          { id: 'M-101', title: 'Discovery & Research', isCompleted: true,  completedAt: new Date('2026-03-25'), dueDate: new Date('2026-03-30'), estimatedTickets: 6,  openTickets: 0 },
          { id: 'M-102', title: 'UX Design',            isCompleted: false, completedAt: null,                  dueDate: new Date('2026-05-10'), estimatedTickets: 10, openTickets: 3 },
          { id: 'M-103', title: 'Beta Release',         isCompleted: false, completedAt: null,                  dueDate: new Date('2026-08-01'), estimatedTickets: 20, openTickets: 1 },
        ],
      },
      created_at: new Date('2026-03-15T09:00:00Z'), updated_at: new Date('2026-04-10T08:00:00Z'),
    },
    {
      id: seededUuid('project', 'PRJ-003'), tenant_id: t('ORG-002'), status: 'on_hold', client_id: u('USR-101'), health_score: 31,
      name: 'Payment Gateway Integration',
      description: 'Integrating Razorpay and Stripe for seamless multi-currency transactions across the platform.',
      metadata: {
        scope: 'Integrate Stripe and Razorpay payment gateways including checkout flow, webhook handling, refund processing, and invoicing.',
        ticketCount: 28, openTicketCount: 12, resolvedThisWeek: 0,
        milestones: [
          { id: 'M-201', title: 'Gateway Selection', isCompleted: true,  completedAt: new Date('2026-02-01'), dueDate: new Date('2026-02-05'), estimatedTickets: 4,  openTickets: 0  },
          { id: 'M-202', title: 'Integration Build', isCompleted: false, completedAt: null,                  dueDate: new Date('2026-04-30'), estimatedTickets: 20, openTickets: 10 },
          { id: 'M-203', title: 'Go-Live',           isCompleted: false, completedAt: null,                  dueDate: new Date('2026-06-30'), estimatedTickets: 8,  openTickets: 2  },
        ],
      },
      created_at: new Date('2026-01-20T09:00:00Z'), updated_at: new Date('2026-04-12T16:00:00Z'),
    },
    {
      id: seededUuid('project', 'PRJ-004'), tenant_id: t('ORG-001'), status: 'completed', client_id: null, health_score: 100,
      name: 'Internal Admin Dashboard',
      description: 'A complete admin dashboard for managing users, roles, permissions, and analytics.',
      metadata: {
        scope: 'Build an internal operations dashboard covering user management, role assignment, audit log, SLA configuration, and report exports.',
        ticketCount: 55, openTicketCount: 0, resolvedThisWeek: 2,
        milestones: [
          { id: 'M-301', title: 'Requirements',        isCompleted: true, completedAt: new Date('2025-06-25'), dueDate: new Date('2025-06-30'), estimatedTickets: 6,  openTickets: 0 },
          { id: 'M-302', title: 'Core Modules',        isCompleted: true, completedAt: new Date('2025-09-15'), dueDate: new Date('2025-10-01'), estimatedTickets: 22, openTickets: 0 },
          { id: 'M-303', title: 'Analytics & Reports', isCompleted: true, completedAt: new Date('2026-02-01'), dueDate: new Date('2026-02-10'), estimatedTickets: 18, openTickets: 0 },
          { id: 'M-304', title: 'UAT & Release',       isCompleted: true, completedAt: new Date('2026-03-15'), dueDate: new Date('2026-03-15'), estimatedTickets: 9,  openTickets: 0 },
        ],
      },
      created_at: new Date('2025-06-15T09:00:00Z'), updated_at: new Date('2026-03-18T14:00:00Z'),
    },
    {
      id: seededUuid('project', 'PRJ-005'), tenant_id: t('ORG-003'), status: 'cancelled', client_id: u('USR-103'), health_score: 0,
      name: 'Legacy System Migration',
      description: 'Migrating legacy monolith to microservices architecture. Cancelled due to budget reallocation.',
      metadata: {
        scope: 'Decompose the existing monolith into 6 discrete microservices.',
        ticketCount: 18, openTicketCount: 0, resolvedThisWeek: 0,
        milestones: [
          { id: 'M-401', title: 'Architecture Design', isCompleted: true,  completedAt: new Date('2025-09-01'), dueDate: new Date('2025-09-15'), estimatedTickets: 8,  openTickets: 0 },
          { id: 'M-402', title: 'Phase 1 Migration',   isCompleted: false, completedAt: null,                  dueDate: new Date('2025-12-01'), estimatedTickets: 30, openTickets: 0 },
        ],
      },
      created_at: new Date('2025-08-10T09:00:00Z'), updated_at: new Date('2026-02-01T10:00:00Z'),
    },
    {
      id: seededUuid('project', 'PRJ-006'), tenant_id: t('ORG-001'), status: 'active', client_id: null, health_score: 54,
      name: 'Custom UI Appearance',
      description: 'User should be able to customise their UI appearance based on their choice. When they log in they should see their customised UI on the screen.',
      metadata: {
        scope: 'User interface customisation including theme selection, colour palette, layout preferences, and font settings. Exclude client branding options from the user role.',
        targetDate: '2026-05-26',
        ticketCount: 8, openTicketCount: 5, resolvedThisWeek: 1,
        milestones: [
          { id: 'M-601', title: 'Discovery & UX Research',     isCompleted: true,  completedAt: new Date('2026-04-10'), dueDate: new Date('2026-04-12'), estimatedTickets: 3,  openTickets: 0 },
          { id: 'M-602', title: 'Settings API & Data Model',   isCompleted: false, completedAt: null, dueDate: new Date('2026-05-02'), estimatedTickets: 8,  openTickets: 3 },
          { id: 'M-603', title: 'Frontend Theme Engine',       isCompleted: false, completedAt: null, dueDate: new Date('2026-05-16'), estimatedTickets: 10, openTickets: 2 },
          { id: 'M-604', title: 'QA & Client Role Exclusions', isCompleted: false, completedAt: null, dueDate: new Date('2026-05-23'), estimatedTickets: 5,  openTickets: 0 },
          { id: 'M-605', title: 'Go-Live',                     isCompleted: false, completedAt: null, dueDate: new Date('2026-05-26'), estimatedTickets: 2,  openTickets: 0 },
        ],
      },
      created_at: new Date('2026-04-20T09:00:00Z'), updated_at: new Date('2026-04-26T10:00:00Z'),
    },
  ];

  const p = (key: string) => seededUuid('project', key);
  const ticketsData = [
    {
      id: seededUuid('ticket', 'TKT-001'), tenant_id: t('ORG-002'), project_id: p('PRJ-003'), ticket_number: 'TKT-001',
      title: 'Production database cluster unresponsive — all queries timing out',
      description: `Our primary PostgreSQL cluster (us-east-1) stopped responding at 03:42 UTC. All read and write queries are timing out after 30 s. The application is returning 503 errors to all users.\n\nSteps already taken:\n- Restarted the read replicas — no improvement\n- Checked CloudWatch: CPU 98%, disk I/O queue length 4200\n- Application logs show "FATAL: remaining connection slots are reserved for non-replication superuser connections"\n\nWe have ~15,000 active users affected. This is a P0 incident.`,
      status: TicketStatus.IN_PROGRESS, priority: TicketPriority.URGENT, category: TicketCategory.INCIDENT,
      tags: ['database', 'postgres', 'production', 'outage'], requester_id: u('USR-101'), assignee_id: u('USR-002'),
      sla_policy_id: seededUuid('sla', 'SLA-001'), sla_deadline_at: new Date('2026-04-16T07:42:00Z'),
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-16T03:44:00Z'), updated_at: new Date('2026-04-16T09:15:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-002'), tenant_id: t('ORG-003'), project_id: p('PRJ-002'), ticket_number: 'TKT-002',
      title: 'Payment processing failing for all Stripe transactions — revenue impact',
      description: `Since approximately 14:30 UTC, all Stripe payment intents are failing with error code "card_declined" even for known good test cards. This affects checkout, subscription renewals, and manual charges.\n\nStripe dashboard shows the API keys are valid. Our webhook endpoint is receiving events but the charge never succeeds.\n\nEstimated revenue impact: £4,200 per hour.`,
      status: TicketStatus.ACKNOWLEDGED, priority: TicketPriority.URGENT, category: TicketCategory.BUG,
      tags: ['payments', 'stripe', 'billing', 'revenue'], requester_id: u('USR-103'), assignee_id: u('USR-003'),
      sla_policy_id: seededUuid('sla', 'SLA-001'), sla_deadline_at: new Date('2026-04-16T18:30:00Z'),
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-16T14:32:00Z'), updated_at: new Date('2026-04-16T15:10:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-003'), tenant_id: t('ORG-002'), project_id: p('PRJ-003'), ticket_number: 'TKT-003',
      title: 'SSO/SAML login broken for all Azure AD users after cert rotation',
      description: `Following our certificate rotation on April 14th, all users authenticating via Azure AD SAML are receiving: "SAML signature validation failed — certificate thumbprint mismatch".\n\nUsers who use email/password login are unaffected. Roughly 340 users in our organisation cannot log in.\n\nWe updated the certificate in Azure AD but did not update the SP metadata on your side. Is there a way to upload the new IdP certificate through the admin panel?`,
      status: TicketStatus.IN_PROGRESS, priority: TicketPriority.HIGH, category: TicketCategory.BUG,
      tags: ['sso', 'saml', 'azure-ad', 'authentication'], requester_id: u('USR-101'), assignee_id: u('USR-004'),
      sla_policy_id: seededUuid('sla', 'SLA-002'), sla_deadline_at: new Date('2026-04-16T10:00:00Z'),
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-14T11:00:00Z'), updated_at: new Date('2026-04-16T08:45:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-004'), tenant_id: t('ORG-004'), project_id: null, ticket_number: 'TKT-004',
      title: 'API rate limiting kicking in at 20 req/s instead of contracted 200 req/s',
      description: `Our integration is being rate-limited at 20 requests/second, but our Enterprise plan specifies 200 req/s. This is causing our real-time dashboard to fall significantly behind.\n\nWe are seeing HTTP 429 responses with: {"error": "rate_limit_exceeded", "limit": 20, "reset_at": "..."}. Our account ID is ACC-7821. Please investigate whether our rate limit tier is misconfigured on your end.`,
      status: TicketStatus.OPEN, priority: TicketPriority.HIGH, category: TicketCategory.BUG,
      tags: ['api', 'rate-limiting', 'enterprise', 'integration'], requester_id: u('USR-104'), assignee_id: null,
      sla_policy_id: seededUuid('sla', 'SLA-002'), sla_deadline_at: new Date('2026-04-18T10:00:00Z'),
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-16T09:00:00Z'), updated_at: new Date('2026-04-16T09:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-005'), tenant_id: t('ORG-002'), project_id: p('PRJ-001'), ticket_number: 'TKT-005',
      title: 'Bulk data export stuck at 0% for exports > 10,000 rows',
      description: `When exporting reports with more than 10,000 rows, the export job starts (shows "Processing…"), then freezes at 0% indefinitely. Smaller exports work fine.\n\nWe need to export ~85,000 records for our end-of-quarter audit. The job was triggered 3 hours ago and still shows 0%.`,
      status: TicketStatus.IN_PROGRESS, priority: TicketPriority.HIGH, category: TicketCategory.BUG,
      tags: ['export', 'reports', 'bug', 'data'], requester_id: u('USR-102'), assignee_id: u('USR-005'),
      sla_policy_id: seededUuid('sla', 'SLA-002'), sla_deadline_at: new Date('2026-04-17T12:00:00Z'),
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-15T09:00:00Z'), updated_at: new Date('2026-04-16T07:30:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-006'), tenant_id: t('ORG-003'), project_id: p('PRJ-002'), ticket_number: 'TKT-006',
      title: 'File attachments exceeding 8 MB silently fail — no error shown to user',
      description: `When users attempt to attach files larger than 8 MB to a ticket, the upload spinner runs indefinitely with no error message. The attachment is never saved. This is a UX regression — previous behaviour showed a clear size-limit error.\n\nMax allowed per our plan is 25 MB per file. The silent failure is causing confusion.`,
      status: TicketStatus.OPEN, priority: TicketPriority.HIGH, category: TicketCategory.BUG,
      tags: ['attachments', 'uploads', 'ux', 'regression'], requester_id: u('USR-103'), assignee_id: u('USR-008'),
      sla_policy_id: seededUuid('sla', 'SLA-002'), sla_deadline_at: new Date('2026-04-19T14:00:00Z'),
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-16T10:20:00Z'), updated_at: new Date('2026-04-16T11:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-007'), tenant_id: t('ORG-001'), project_id: p('PRJ-006'), ticket_number: 'TKT-007',
      title: 'Email notifications not delivered when ticket is assigned to a team',
      description: `When a ticket is assigned to a team (rather than a specific agent), the "ticket assigned" email notification is not sent to any team members. Direct-to-agent assignments still work correctly.\n\nThis is causing agents to miss tickets that come in during off-hours.`,
      status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, category: TicketCategory.BUG,
      tags: ['notifications', 'email', 'teams', 'assignment'], requester_id: u('USR-003'), assignee_id: null,
      sla_policy_id: seededUuid('sla', 'SLA-003'), sla_deadline_at: new Date('2026-04-22T09:00:00Z'),
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-16T11:30:00Z'), updated_at: new Date('2026-04-16T11:30:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-008'), tenant_id: t('ORG-004'), project_id: null, ticket_number: 'TKT-008',
      title: 'Knowledge base search returns irrelevant results for technical queries',
      description: `Searching for specific error codes (e.g. "ERR_CONN_RESET", "ECONNREFUSED") returns articles about unrelated topics. Exact-string queries that worked in version 2.1 are no longer matching correctly after the semantic search upgrade in 2.2.`,
      status: TicketStatus.ACKNOWLEDGED, priority: TicketPriority.MEDIUM, category: TicketCategory.BUG,
      tags: ['knowledge-base', 'search', 'semantic', 'regression'], requester_id: u('USR-104'), assignee_id: u('USR-003'),
      sla_policy_id: seededUuid('sla', 'SLA-003'), sla_deadline_at: new Date('2026-04-19T16:00:00Z'),
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-15T13:00:00Z'), updated_at: new Date('2026-04-16T08:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-009'), tenant_id: t('ORG-001'), project_id: p('PRJ-006'), ticket_number: 'TKT-009',
      title: 'Bulk ticket reassignment tool fails when selecting more than 50 tickets',
      description: `The "Reassign Selected" action in the ticket queue fails silently when more than 50 tickets are selected. Selecting 1–49 tickets and reassigning works as expected. The network request never fires when 50+ are selected.`,
      status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, category: TicketCategory.BUG,
      tags: ['bulk-actions', 'assignment', 'ticket-queue'], requester_id: u('USR-002'), assignee_id: u('USR-004'),
      sla_policy_id: seededUuid('sla', 'SLA-003'), sla_deadline_at: new Date('2026-04-22T07:00:00Z'),
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-16T07:00:00Z'), updated_at: new Date('2026-04-16T07:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-010'), tenant_id: t('ORG-002'), project_id: p('PRJ-001'), ticket_number: 'TKT-010',
      title: 'Mobile app crashes on iOS 17.4 when opening ticket detail view',
      description: `The iOS mobile app consistently crashes when tapping into a ticket detail view on devices running iOS 17.4. The app opens normally on iOS 16 and iOS 17.3. Crash log attached.\n\nCrash signature: EXC_CRASH (SIGABRT) — Thread 1: Fatal error: Unexpectedly found nil while unwrapping an Optional value.`,
      status: TicketStatus.IN_PROGRESS, priority: TicketPriority.MEDIUM, category: TicketCategory.BUG,
      tags: ['mobile', 'ios', 'crash', 'ticket-detail'], requester_id: u('USR-102'), assignee_id: u('USR-005'),
      sla_policy_id: seededUuid('sla', 'SLA-003'), sla_deadline_at: new Date('2026-04-18T11:00:00Z'),
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-13T10:00:00Z'), updated_at: new Date('2026-04-16T09:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-011'), tenant_id: t('ORG-001'), project_id: p('PRJ-004'), ticket_number: 'TKT-011',
      title: 'Audit log not capturing field-level changes on ticket updates',
      description: `When an agent updates a ticket's priority or category, the audit log only records "ticket updated" without showing the before/after field values. The previous version showed detailed change diffs. This is blocking our compliance review.`,
      status: TicketStatus.ACKNOWLEDGED, priority: TicketPriority.MEDIUM, category: TicketCategory.BUG,
      tags: ['audit', 'compliance', 'ticket-updates'], requester_id: u('USR-001'), assignee_id: u('USR-008'),
      sla_policy_id: seededUuid('sla', 'SLA-003'), sla_deadline_at: new Date('2026-04-19T09:00:00Z'),
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-15T08:00:00Z'), updated_at: new Date('2026-04-15T15:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-012'), tenant_id: t('ORG-001'), project_id: p('PRJ-006'), ticket_number: 'TKT-012',
      title: 'Custom SLA policy not applied when ticket is re-opened after resolution',
      description: `When a ticket is resolved and then re-opened by the client, our custom SLA policy (4-hour response, 24-hour resolution) is not reapplied — instead the default policy kicks in. This leads to incorrect SLA breach alerts.`,
      status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, category: TicketCategory.BUG,
      tags: ['sla', 'reopen', 'policy'], requester_id: u('USR-006'), assignee_id: null,
      sla_policy_id: seededUuid('sla', 'SLA-003'), sla_deadline_at: new Date('2026-04-22T10:00:00Z'),
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-16T10:00:00Z'), updated_at: new Date('2026-04-16T10:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-013'), tenant_id: t('ORG-001'), project_id: p('PRJ-006'), ticket_number: 'TKT-013',
      title: 'Feature: Allow agents to save canned responses / reply templates',
      description: `Our team frequently sends similar replies for common issues (password resets, VPN setup, etc.). Having a library of canned responses that agents can insert and personalise would significantly reduce average handle time.\n\nWe'd ideally want: per-agent personal templates + shared team templates, with variable substitution (e.g. {{customer_name}}).`,
      status: TicketStatus.OPEN, priority: TicketPriority.LOW, category: TicketCategory.FEATURE_REQUEST,
      tags: ['canned-responses', 'templates', 'productivity'], requester_id: u('USR-003'), assignee_id: null,
      sla_policy_id: null, sla_deadline_at: null,
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-10T14:00:00Z'), updated_at: new Date('2026-04-14T09:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-014'), tenant_id: t('ORG-001'), project_id: p('PRJ-006'), ticket_number: 'TKT-014',
      title: 'Feature: Configurable auto-close policy for resolved tickets',
      description: `We'd like the ability to set a per-organisation policy to automatically close tickets that have been in "Resolved" state for N days without client response. Our preferred value is 7 days.`,
      status: TicketStatus.OPEN, priority: TicketPriority.LOW, category: TicketCategory.FEATURE_REQUEST,
      tags: ['auto-close', 'workflow', 'sla'], requester_id: u('USR-002'), assignee_id: null,
      sla_policy_id: null, sla_deadline_at: null,
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-12T11:00:00Z'), updated_at: new Date('2026-04-12T11:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-015'), tenant_id: t('ORG-003'), project_id: p('PRJ-002'), ticket_number: 'TKT-015',
      title: 'Feature: Webhook support for ticket status changes',
      description: `We need to be able to trigger external webhooks when a ticket changes status (particularly OPEN → IN_PROGRESS and any → RESOLVED). This would let us sync ticket state to our internal Jira and Slack.`,
      status: TicketStatus.ACKNOWLEDGED, priority: TicketPriority.LOW, category: TicketCategory.FEATURE_REQUEST,
      tags: ['webhooks', 'integrations', 'jira', 'slack'], requester_id: u('USR-103'), assignee_id: u('USR-006'),
      sla_policy_id: null, sla_deadline_at: null,
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-08T09:00:00Z'), updated_at: new Date('2026-04-11T14:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-016'), tenant_id: t('ORG-003'), project_id: p('PRJ-005'), ticket_number: 'TKT-016',
      title: 'How do I export SLA compliance data to CSV for board reporting?',
      description: `I need to produce a monthly SLA compliance report for our board meeting. I can see the charts on the analytics page but cannot find a CSV export button. Is this available in our plan (Business)?`,
      status: TicketStatus.RESOLVED, priority: TicketPriority.LOW, category: TicketCategory.QUESTION,
      tags: ['export', 'sla', 'reporting', 'csv'], requester_id: u('USR-103'), assignee_id: u('USR-003'),
      sla_policy_id: seededUuid('sla', 'SLA-004'), sla_deadline_at: new Date('2026-04-13T12:00:00Z'),
      resolved_at: new Date('2026-04-12T10:00:00Z'), closed_at: null, created_at: new Date('2026-04-10T11:00:00Z'), updated_at: new Date('2026-04-12T10:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-017'), tenant_id: t('ORG-002'), project_id: p('PRJ-001'), ticket_number: 'TKT-017',
      title: 'Can we set different SLA policies for different ticket categories?',
      description: `We want critical bugs to have a 1-hour response SLA while feature requests get a 48-hour response. Is per-category SLA configuration supported?`,
      status: TicketStatus.RESOLVED, priority: TicketPriority.LOW, category: TicketCategory.QUESTION,
      tags: ['sla', 'configuration', 'policy'], requester_id: u('USR-101'), assignee_id: u('USR-002'),
      sla_policy_id: seededUuid('sla', 'SLA-004'), sla_deadline_at: new Date('2026-04-11T10:00:00Z'),
      resolved_at: new Date('2026-04-10T14:00:00Z'), closed_at: null, created_at: new Date('2026-04-08T10:00:00Z'), updated_at: new Date('2026-04-10T14:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-018'), tenant_id: t('ORG-002'), project_id: p('PRJ-003'), ticket_number: 'TKT-018',
      title: '2FA SMS codes not delivered to +44 UK numbers',
      description: `Two-factor authentication SMS codes are not being delivered to UK phone numbers (+44 prefix). US and Canadian numbers work fine. Affected users cannot log in.`,
      status: TicketStatus.RESOLVED, priority: TicketPriority.HIGH, category: TicketCategory.BUG,
      tags: ['2fa', 'sms', 'authentication', 'uk'], requester_id: u('USR-101'), assignee_id: u('USR-004'),
      sla_policy_id: seededUuid('sla', 'SLA-002'), sla_deadline_at: new Date('2026-04-12T09:00:00Z'),
      resolved_at: new Date('2026-04-11T16:00:00Z'), closed_at: null, created_at: new Date('2026-04-09T09:30:00Z'), updated_at: new Date('2026-04-11T16:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-019'), tenant_id: t('ORG-002'), project_id: p('PRJ-001'), ticket_number: 'TKT-019',
      title: 'Analytics dashboard charts not rendering in Safari 17',
      description: `All chart visualisations on the analytics page appear blank in Safari 17 (macOS Sonoma). The data loads (visible in DevTools network tab) but the SVG canvas is 0×0. Chrome and Firefox are unaffected.`,
      status: TicketStatus.RESOLVED, priority: TicketPriority.MEDIUM, category: TicketCategory.BUG,
      tags: ['analytics', 'safari', 'charts', 'rendering'], requester_id: u('USR-102'), assignee_id: u('USR-005'),
      sla_policy_id: seededUuid('sla', 'SLA-003'), sla_deadline_at: new Date('2026-04-10T12:00:00Z'),
      resolved_at: new Date('2026-04-09T11:00:00Z'), closed_at: null, created_at: new Date('2026-04-06T14:00:00Z'), updated_at: new Date('2026-04-09T11:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-020'), tenant_id: t('ORG-003'), project_id: p('PRJ-002'), ticket_number: 'TKT-020',
      title: 'Password reset link expiry too short — users unable to complete reset',
      description: `Users who don't check their email promptly find that the password reset link has already expired. The current expiry appears to be 15 minutes. Industry standard is 1 hour.`,
      status: TicketStatus.CLOSED, priority: TicketPriority.LOW, category: TicketCategory.BUG,
      tags: ['password-reset', 'email', 'ux'], requester_id: u('USR-103'), assignee_id: u('USR-003'),
      sla_policy_id: seededUuid('sla', 'SLA-004'), sla_deadline_at: new Date('2026-03-24T10:00:00Z'),
      resolved_at: new Date('2026-03-22T14:00:00Z'), closed_at: new Date('2026-03-25T10:00:00Z'), created_at: new Date('2026-03-19T09:00:00Z'), updated_at: new Date('2026-03-25T10:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-021'), tenant_id: t('ORG-002'), project_id: p('PRJ-003'), ticket_number: 'TKT-021',
      title: 'Billing page shows incorrect plan tier after downgrade',
      description: `After downgrading from Enterprise to Business, the billing page still shows "Enterprise Plan" for 3 days. Resolved itself eventually — likely a cache issue.`,
      status: TicketStatus.CLOSED, priority: TicketPriority.LOW, category: TicketCategory.BUG,
      tags: ['billing', 'cache', 'plan'], requester_id: u('USR-101'), assignee_id: u('USR-004'),
      sla_policy_id: seededUuid('sla', 'SLA-004'), sla_deadline_at: new Date('2026-03-07T10:00:00Z'),
      resolved_at: new Date('2026-03-07T15:00:00Z'), closed_at: new Date('2026-03-10T09:00:00Z'), created_at: new Date('2026-03-03T11:00:00Z'), updated_at: new Date('2026-03-10T09:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-022'), tenant_id: t('ORG-001'), project_id: p('PRJ-004'), ticket_number: 'TKT-022',
      title: 'Onboarding: Configure SSO and custom domain for Sunrise Healthcare',
      description: `New Enterprise client onboarding task. Configure Azure AD SSO integration and set up custom domain (support.sunrisehealthcare.org) for the customer portal.\n\nChecklist:\n- [ ] Provision tenant in production\n- [ ] Configure Azure AD SAML SP metadata\n- [ ] DNS CNAME setup\n- [ ] Test end-to-end login flow\n- [ ] Send welcome pack to Rachel Kim (IT Admin)`,
      status: TicketStatus.IN_PROGRESS, priority: TicketPriority.MEDIUM, category: TicketCategory.TASK,
      tags: ['onboarding', 'sso', 'enterprise', 'custom-domain'], requester_id: u('USR-001'), assignee_id: u('USR-002'),
      sla_policy_id: null, sla_deadline_at: null,
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-14T09:00:00Z'), updated_at: new Date('2026-04-16T08:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-023'), tenant_id: t('ORG-001'), project_id: p('PRJ-004'), ticket_number: 'TKT-023',
      title: 'Q2 SLA policy review — update thresholds for all Enterprise clients',
      description: `Quarterly review of SLA thresholds across all Enterprise tenants. Proposed changes:\n- Critical: response 30 min → 15 min\n- High: response 2 h → 1 h\n- Enterprise resolution SLA: 4 h → 2 h for critical\n\nRequires approval from Nina Patel and sign-off from each account owner.`,
      status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, category: TicketCategory.TASK,
      tags: ['sla', 'q2-review', 'enterprise', 'policy'], requester_id: u('USR-006'), assignee_id: u('USR-001'),
      sla_policy_id: null, sla_deadline_at: null,
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-15T14:00:00Z'), updated_at: new Date('2026-04-15T14:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-024'), tenant_id: t('ORG-006'), project_id: null, ticket_number: 'TKT-024',
      title: 'Apex Logistics: missing invoice for March 2026',
      description: 'Client reports they have not received the March 2026 invoice. Please resend to accounts@apexlogistics.com.',
      status: TicketStatus.RESOLVED, priority: TicketPriority.LOW, category: TicketCategory.BILLING,
      tags: ['billing', 'invoice', 'apex-logistics'], requester_id: u('USR-103'), assignee_id: u('USR-003'),
      sla_policy_id: seededUuid('sla', 'SLA-004'), sla_deadline_at: new Date('2026-04-05T10:00:00Z'),
      resolved_at: new Date('2026-04-04T11:00:00Z'), closed_at: null, created_at: new Date('2026-04-02T09:00:00Z'), updated_at: new Date('2026-04-04T11:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-025'), tenant_id: t('ORG-004'), project_id: null, ticket_number: 'TKT-025',
      title: 'Global Finance: 2FA enforcement not applying to SSO logins',
      description: 'Our 2FA enforcement policy should apply to all login methods including SSO. Currently SSO users bypass 2FA. This is a compliance requirement.',
      status: TicketStatus.OPEN, priority: TicketPriority.HIGH, category: TicketCategory.BUG,
      tags: ['2fa', 'sso', 'security', 'compliance'], requester_id: u('USR-104'), assignee_id: u('USR-006'),
      sla_policy_id: seededUuid('sla', 'SLA-002'), sla_deadline_at: new Date('2026-04-18T09:00:00Z'),
      resolved_at: null, closed_at: null, created_at: new Date('2026-04-16T11:00:00Z'), updated_at: new Date('2026-04-16T11:00:00Z'),
    },
  ];

  // ── PRJ-006 tickets (Custom UI Appearance — ORG-001) ──────────────────────
  // Scoped to ORG-001 tenant; tagged for milestone matching; 3 SLA-breached for churn/health signal
  const prj006Tickets = [
    {
      id: seededUuid('ticket', 'TKT-051'), tenant_id: t('ORG-001'), project_id: p('PRJ-006'), ticket_number: 'TKT-051',
      title: 'Theme settings API endpoint returns 500 on PATCH',
      description: 'When a user updates their appearance preferences via the settings API, the PATCH /users/me/preferences endpoint throws an internal server error. Affects all theme customisation flows.',
      status: TicketStatus.IN_PROGRESS, priority: TicketPriority.HIGH, category: TicketCategory.BUG,
      requester_id: u('USR-004'), assignee_id: u('USR-003'),
      tags: ['settings-api', 'appearance', 'theme', 'M-602'],
      sla_policy_id: seededUuid('sla', 'SLA-002'),
      sla_deadline_at: new Date('2026-04-22T09:00:00Z'), // breached
      first_response_at: new Date('2026-04-20T10:30:00Z'),
      resolved_at: null, closed_at: null,
      created_at: new Date('2026-04-20T09:00:00Z'), updated_at: new Date('2026-04-21T14:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-052'), tenant_id: t('ORG-001'), project_id: p('PRJ-006'), ticket_number: 'TKT-052',
      title: 'Dark mode preference not persisted across sessions',
      description: 'Users who select dark mode in appearance settings find the theme resets to light on next login. The preference is not being saved to the user profile.',
      status: TicketStatus.OPEN, priority: TicketPriority.HIGH, category: TicketCategory.BUG,
      requester_id: u('USR-005'), assignee_id: u('USR-002'),
      tags: ['dark-mode', 'appearance', 'persistence', 'theme', 'M-603'],
      sla_policy_id: seededUuid('sla', 'SLA-002'),
      sla_deadline_at: new Date('2026-04-23T09:00:00Z'), // breached
      first_response_at: null,
      resolved_at: null, closed_at: null,
      created_at: new Date('2026-04-21T08:00:00Z'), updated_at: new Date('2026-04-21T08:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-053'), tenant_id: t('ORG-001'), project_id: p('PRJ-006'), ticket_number: 'TKT-053',
      title: 'Custom accent colour picker not rendering in Safari',
      description: 'The colour picker component for accent colour selection in user appearance settings is blank in Safari 17.x. Works correctly in Chrome and Firefox.',
      status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, category: TicketCategory.BUG,
      requester_id: u('USR-006'), assignee_id: null,
      tags: ['colour-picker', 'safari', 'appearance', 'frontend', 'M-603'],
      sla_policy_id: seededUuid('sla', 'SLA-003'),
      sla_deadline_at: new Date('2026-04-24T09:00:00Z'), // breached
      first_response_at: null,
      resolved_at: null, closed_at: null,
      created_at: new Date('2026-04-22T10:00:00Z'), updated_at: new Date('2026-04-22T10:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-054'), tenant_id: t('ORG-001'), project_id: p('PRJ-006'), ticket_number: 'TKT-054',
      title: 'Layout density option (compact/comfortable) required in user settings',
      description: 'Feature request from internal agents: allow users to toggle between compact and comfortable layout density in their appearance preferences. Should apply to ticket list and table views.',
      status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, category: TicketCategory.FEATURE_REQUEST,
      requester_id: u('USR-001'), assignee_id: u('USR-003'),
      tags: ['layout', 'density', 'appearance', 'user-settings', 'M-602'],
      sla_policy_id: seededUuid('sla', 'SLA-003'),
      sla_deadline_at: new Date('2026-05-05T09:00:00Z'),
      first_response_at: new Date('2026-04-23T09:30:00Z'),
      resolved_at: null, closed_at: null,
      created_at: new Date('2026-04-23T09:00:00Z'), updated_at: new Date('2026-04-23T14:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-055'), tenant_id: t('ORG-001'), project_id: p('PRJ-006'), ticket_number: 'TKT-055',
      title: 'Font size preference should apply to KB article body text',
      description: 'When a user sets a preferred font size in appearance settings, the setting should also apply to knowledge base article content, not just the main UI.',
      status: TicketStatus.OPEN, priority: TicketPriority.LOW, category: TicketCategory.FEATURE_REQUEST,
      requester_id: u('USR-002'), assignee_id: null,
      tags: ['font', 'appearance', 'knowledge-base', 'user-settings', 'M-603'],
      sla_policy_id: seededUuid('sla', 'SLA-004'),
      sla_deadline_at: new Date('2026-05-10T09:00:00Z'),
      first_response_at: null,
      resolved_at: null, closed_at: null,
      created_at: new Date('2026-04-24T11:00:00Z'), updated_at: new Date('2026-04-24T11:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-056'), tenant_id: t('ORG-001'), project_id: p('PRJ-006'), ticket_number: 'TKT-056',
      title: 'Client role should not have access to branding customisation options',
      description: 'Users with the CLIENT role can currently access the branding customisation tab in appearance settings. Per scope, branding options must be restricted to ADMIN and LEAD roles only.',
      status: TicketStatus.IN_PROGRESS, priority: TicketPriority.URGENT, category: TicketCategory.BUG,
      requester_id: u('USR-001'), assignee_id: u('USR-002'),
      tags: ['rbac', 'branding', 'appearance', 'client-role', 'M-604'],
      sla_policy_id: seededUuid('sla', 'SLA-001'),
      sla_deadline_at: new Date('2026-04-27T17:00:00Z'),
      first_response_at: new Date('2026-04-24T12:00:00Z'),
      resolved_at: null, closed_at: null,
      created_at: new Date('2026-04-24T11:30:00Z'), updated_at: new Date('2026-04-25T09:00:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-057'), tenant_id: t('ORG-001'), project_id: p('PRJ-006'), ticket_number: 'TKT-057',
      title: 'Appearance settings should preview changes in real-time before saving',
      description: 'Currently the user must save appearance changes and reload to see them. A live preview panel showing how the UI will look before confirming would significantly improve UX.',
      status: TicketStatus.ACKNOWLEDGED, priority: TicketPriority.MEDIUM, category: TicketCategory.FEATURE_REQUEST,
      requester_id: u('USR-003'), assignee_id: u('USR-004'),
      tags: ['preview', 'appearance', 'ux', 'user-settings', 'M-603'],
      sla_policy_id: seededUuid('sla', 'SLA-003'),
      sla_deadline_at: new Date('2026-05-08T09:00:00Z'),
      first_response_at: new Date('2026-04-25T08:30:00Z'),
      resolved_at: null, closed_at: null,
      created_at: new Date('2026-04-24T15:00:00Z'), updated_at: new Date('2026-04-25T08:30:00Z'),
    },
    {
      id: seededUuid('ticket', 'TKT-058'), tenant_id: t('ORG-001'), project_id: p('PRJ-006'), ticket_number: 'TKT-058',
      title: 'Theme reset button clears all preferences without confirmation dialog',
      description: 'The "Reset to Default" button in appearance settings immediately clears all user preferences without showing a confirmation dialog. Users have accidentally lost their settings.',
      status: TicketStatus.RESOLVED, priority: TicketPriority.LOW, category: TicketCategory.BUG,
      requester_id: u('USR-004'), assignee_id: u('USR-003'),
      tags: ['theme', 'reset', 'appearance', 'confirmation', 'M-602'],
      sla_policy_id: seededUuid('sla', 'SLA-004'),
      sla_deadline_at: new Date('2026-04-28T09:00:00Z'),
      first_response_at: new Date('2026-04-23T10:00:00Z'),
      resolved_at: new Date('2026-04-25T16:00:00Z'), closed_at: null,
      created_at: new Date('2026-04-23T09:30:00Z'), updated_at: new Date('2026-04-25T16:00:00Z'),
    },
  ];

  // Insert projects first (tickets FK-depend on projects)
  for (const project of projectsData) {
    await prisma.project.create({ data: project as any });
  }
  console.log(`✅ Created ${projectsData.length} projects`);

  for (const ticket of ticketsData) {
    await prisma.ticket.create({ data: ticket as any });
  }
  console.log(`✅ Created ${ticketsData.length} tickets`);

  for (const ticket of prj006Tickets) {
    await prisma.ticket.create({ data: ticket as any });
  }
  console.log(`✅ Created ${prj006Tickets.length} PRJ-006 tickets`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. COMMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  const commentsData = [
    // TKT-001
    { id: seededUuid('comment', 'CMT-001'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-001'), author_id: u('USR-101'), body: 'URGENT — we have 15,000 users completely locked out. This is impacting a live presentation for a major client. Please escalate immediately.', is_internal: false, mentions: [], created_at: new Date('2026-04-16T03:46:00Z'), updated_at: new Date('2026-04-16T03:46:00Z') },
    { id: seededUuid('comment', 'CMT-002'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-001'), author_id: u('USR-002'), body: 'Acknowledged. I have escalated this to our DB ops team and am joining your incident channel now. Initial analysis suggests connection pool exhaustion — can you confirm what change was deployed in the last 2 hours?', is_internal: false, mentions: [], created_at: new Date('2026-04-16T03:52:00Z'), updated_at: new Date('2026-04-16T03:52:00Z') },
    { id: seededUuid('comment', 'CMT-003'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-001'), author_id: u('USR-002'), body: '[INTERNAL] CloudWatch confirms connection count hit max_connections (500). Likely culprit is the new connection pool config deployed at 03:30 UTC. Checking with DevOps to roll back.\n\nAlso note: customer is in a live sales demo — priority above all else.', is_internal: true, mentions: ['USR-006'], created_at: new Date('2026-04-16T03:55:00Z'), updated_at: new Date('2026-04-16T03:55:00Z') },
    { id: seededUuid('comment', 'CMT-004'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-001'), author_id: u('USR-101'), body: 'We deployed a connection pool size change (from 50 to 200 per node) at 03:28 UTC. Rolling it back now on our side — should we coordinate?', is_internal: false, mentions: [], created_at: new Date('2026-04-16T04:05:00Z'), updated_at: new Date('2026-04-16T04:05:00Z') },
    { id: seededUuid('comment', 'CMT-005'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-001'), author_id: u('USR-002'), body: 'Yes — please hold your rollback for 5 minutes. We are applying a pgbouncer config patch on our end first. Will confirm when ready.', is_internal: false, mentions: [], created_at: new Date('2026-04-16T04:10:00Z'), updated_at: new Date('2026-04-16T04:10:00Z') },
    { id: seededUuid('comment', 'CMT-006'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-001'), author_id: u('USR-002'), body: 'pgbouncer patch applied. Connections are draining — we are seeing connection count drop from 498 to 320 and query latency recovering. Please proceed with your rollback now.', is_internal: false, mentions: [], created_at: new Date('2026-04-16T04:22:00Z'), updated_at: new Date('2026-04-16T04:22:00Z') },
    { id: seededUuid('comment', 'CMT-007'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-001'), author_id: u('USR-101'), body: "Application is responding normally again. Users can log in. The SLA breach on resolution is noted — we'll discuss during our quarterly review. Thank you for the rapid response.", is_internal: false, mentions: [], created_at: new Date('2026-04-16T04:48:00Z'), updated_at: new Date('2026-04-16T04:48:00Z') },
    // TKT-002
    { id: seededUuid('comment', 'CMT-010'), tenant_id: t('ORG-003'), ticket_id: seededUuid('ticket', 'TKT-002'), author_id: u('USR-103'), body: 'Confirmed on staging and production. All card types fail. We have halted all marketing campaigns to avoid new sign-ups hitting this.', is_internal: false, mentions: [], created_at: new Date('2026-04-16T14:40:00Z'), updated_at: new Date('2026-04-16T14:40:00Z') },
    { id: seededUuid('comment', 'CMT-011'), tenant_id: t('ORG-003'), ticket_id: seededUuid('ticket', 'TKT-002'), author_id: u('USR-003'), body: '[INTERNAL] Stripe webhook logs show a "restricted_key" scope error starting 14:28 UTC. This correlates with a Stripe API key rotation done by our infra team at 14:25. The new restricted key is likely missing the "charges:write" permission. Checking with Stripe dashboard.', is_internal: true, mentions: ['USR-002'], created_at: new Date('2026-04-16T15:00:00Z'), updated_at: new Date('2026-04-16T15:00:00Z') },
    { id: seededUuid('comment', 'CMT-012'), tenant_id: t('ORG-003'), ticket_id: seededUuid('ticket', 'TKT-002'), author_id: u('USR-003'), body: 'We have identified the root cause. Our infrastructure team rotated the Stripe API key and the new key was created with insufficient permissions. We are issuing a corrected key now. Expect resolution within 30 minutes.', is_internal: false, mentions: [], created_at: new Date('2026-04-16T15:15:00Z'), updated_at: new Date('2026-04-16T15:15:00Z') },
    // TKT-003
    { id: seededUuid('comment', 'CMT-020'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-003'), author_id: u('USR-101'), body: 'To clarify — we rotated the IdP signing certificate on April 14th as part of our annual security review. We updated Azure AD but assumed the SP side would auto-refresh. 340 users are locked out of the platform.', is_internal: false, mentions: [], created_at: new Date('2026-04-14T11:10:00Z'), updated_at: new Date('2026-04-14T11:10:00Z') },
    { id: seededUuid('comment', 'CMT-021'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-003'), author_id: u('USR-004'), body: 'Understood. To resolve this you will need to provide the new IdP metadata XML. Please go to your Azure AD Enterprise Application → Single sign-on → Download Federation Metadata XML and attach it to this ticket.', is_internal: false, mentions: [], created_at: new Date('2026-04-14T12:30:00Z'), updated_at: new Date('2026-04-14T12:30:00Z') },
    { id: seededUuid('comment', 'CMT-022'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-003'), author_id: u('USR-101'), body: 'Metadata XML attached.', is_internal: false, mentions: [], created_at: new Date('2026-04-14T13:05:00Z'), updated_at: new Date('2026-04-14T13:05:00Z') },
    { id: seededUuid('comment', 'CMT-023'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-003'), author_id: u('USR-004'), body: '[INTERNAL] Metadata uploaded and SP certificate updated in our IdP config. Testing with a test Azure AD account — SAML assertion is valid. Monitoring to confirm all 340 users can log in. Will update customer once confirmed.', is_internal: true, mentions: [], created_at: new Date('2026-04-16T08:40:00Z'), updated_at: new Date('2026-04-16T08:40:00Z') },
    // TKT-010
    { id: seededUuid('comment', 'CMT-040'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-010'), author_id: u('USR-102'), body: 'Reproduced on iPhone 15 Pro (iOS 17.4.1) and iPhone 14 (iOS 17.4). Not reproducible on iOS 17.3. Crash log attached to original ticket.', is_internal: false, mentions: [], created_at: new Date('2026-04-13T10:30:00Z'), updated_at: new Date('2026-04-13T10:30:00Z') },
    { id: seededUuid('comment', 'CMT-041'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-010'), author_id: u('USR-005'), body: '[INTERNAL] Crash is in TicketDetailViewController.swift:142 — we are force-unwrapping `ticket.assignee?.avatarURL` which returns nil in the new API response shape. iOS 17.4 is stricter about optional chaining in Swift. One-line fix — submitting hotfix PR now.', is_internal: true, mentions: ['USR-002'], created_at: new Date('2026-04-13T14:00:00Z'), updated_at: new Date('2026-04-13T14:00:00Z') },
    { id: seededUuid('comment', 'CMT-042'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-010'), author_id: u('USR-005'), body: 'We have identified the crash — a nil unwrapping issue in the ticket detail screen triggered by a change in the iOS 17.4 Swift runtime. A hotfix build (v2.3.1) is in App Store review and should be available within 24 hours.', is_internal: false, mentions: [], created_at: new Date('2026-04-14T09:00:00Z'), updated_at: new Date('2026-04-14T09:00:00Z') },
    // TKT-022
    { id: seededUuid('comment', 'CMT-060'), tenant_id: t('ORG-001'), ticket_id: seededUuid('ticket', 'TKT-022'), author_id: u('USR-001'), body: '[INTERNAL] Tenant provisioned in prod. DNS CNAME is pending on client side. Priya — please coordinate with Ben Harper on the Azure AD SAML metadata exchange.', is_internal: true, mentions: ['USR-002'], created_at: new Date('2026-04-14T10:00:00Z'), updated_at: new Date('2026-04-14T10:00:00Z') },
    { id: seededUuid('comment', 'CMT-061'), tenant_id: t('ORG-001'), ticket_id: seededUuid('ticket', 'TKT-022'), author_id: u('USR-002'), body: '[INTERNAL] DNS is live. SSO metadata exchange complete. Running end-to-end test now. Should be done by EOD.', is_internal: true, mentions: [], created_at: new Date('2026-04-16T07:55:00Z'), updated_at: new Date('2026-04-16T07:55:00Z') },
    // Additional comments for TKT-011
    { id: seededUuid('comment', 'CMT-070'), tenant_id: t('ORG-001'), ticket_id: seededUuid('ticket', 'TKT-011'), author_id: u('USR-008'), body: 'I will pick this up today. Need to update the audit middleware to capture before/after diffs for priority, category, status, and assignee fields.', is_internal: false, mentions: [], created_at: new Date('2026-04-15T09:00:00Z'), updated_at: new Date('2026-04-15T09:00:00Z') },
    // Additional comments for TKT-016
    { id: seededUuid('comment', 'CMT-080'), tenant_id: t('ORG-003'), ticket_id: seededUuid('ticket', 'TKT-016'), author_id: u('USR-003'), body: 'Yes — CSV export is available on the Business plan. Navigate to Analytics → SLA Compliance → click the download icon in the top-right of the chart. You can select monthly or quarterly range.', is_internal: false, mentions: [], created_at: new Date('2026-04-10T14:00:00Z'), updated_at: new Date('2026-04-10T14:00:00Z') },
    { id: seededUuid('comment', 'CMT-081'), tenant_id: t('ORG-003'), ticket_id: seededUuid('ticket', 'TKT-016'), author_id: u('USR-103'), body: 'Found it — thank you! Would be helpful if the button was more visible.', is_internal: false, mentions: [], created_at: new Date('2026-04-11T09:00:00Z'), updated_at: new Date('2026-04-11T09:00:00Z') },
    // Additional comments for TKT-017
    { id: seededUuid('comment', 'CMT-090'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-017'), author_id: u('USR-002'), body: 'Absolutely. You can create custom SLA policies under Organisation Settings → SLA Policies. Each policy can be tied to a category + priority combination.', is_internal: false, mentions: [], created_at: new Date('2026-04-08T12:00:00Z'), updated_at: new Date('2026-04-08T12:00:00Z') },
    { id: seededUuid('comment', 'CMT-091'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-017'), author_id: u('USR-101'), body: 'Great — I have set up the policies. Is there a way to bulk-apply them to existing tickets?', is_internal: false, mentions: [], created_at: new Date('2026-04-09T10:00:00Z'), updated_at: new Date('2026-04-09T10:00:00Z') },
    { id: seededUuid('comment', 'CMT-092'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-017'), author_id: u('USR-002'), body: 'Not yet via the UI, but I can run a bulk update script for you. Please send me the ticket IDs.', is_internal: false, mentions: [], created_at: new Date('2026-04-09T11:00:00Z'), updated_at: new Date('2026-04-09T11:00:00Z') },
    // Additional comments for TKT-018
    { id: seededUuid('comment', 'CMT-100'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-018'), author_id: u('USR-101'), body: 'Our UK team (12 people) cannot log in. This started yesterday afternoon.', is_internal: false, mentions: [], created_at: new Date('2026-04-09T10:00:00Z'), updated_at: new Date('2026-04-09T10:00:00Z') },
    { id: seededUuid('comment', 'CMT-101'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-018'), author_id: u('USR-004'), body: 'Checking with our SMS provider. There was a routing issue affecting +44 numbers. A fix was deployed this morning — can you confirm codes are arriving now?', is_internal: false, mentions: [], created_at: new Date('2026-04-10T09:00:00Z'), updated_at: new Date('2026-04-10T09:00:00Z') },
    { id: seededUuid('comment', 'CMT-102'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-018'), author_id: u('USR-101'), body: 'Confirmed working. Thanks for the quick turnaround.', is_internal: false, mentions: [], created_at: new Date('2026-04-10T15:00:00Z'), updated_at: new Date('2026-04-10T15:00:00Z') },
    { id: seededUuid('comment', 'CMT-103'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-018'), author_id: u('USR-004'), body: '[INTERNAL] Provider incident report: Twilio had a carrier routing issue for UK SMS between 2026-04-08 14:00 UTC and 2026-04-10 08:00 UTC. We have switched to a backup provider for +44.', is_internal: true, mentions: [], created_at: new Date('2026-04-11T10:00:00Z'), updated_at: new Date('2026-04-11T10:00:00Z') },
    // Additional comments for TKT-019
    { id: seededUuid('comment', 'CMT-110'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-019'), author_id: u('USR-102'), body: 'This is affecting our entire analytics team. All Safari users see blank charts.', is_internal: false, mentions: [], created_at: new Date('2026-04-06T15:00:00Z'), updated_at: new Date('2026-04-06T15:00:00Z') },
    { id: seededUuid('comment', 'CMT-111'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-019'), author_id: u('USR-005'), body: 'Root cause: Safari 17 has a new CSP policy that blocks inline styles injected by our charting library. We are updating the library and adding explicit dimensions to the SVG containers.', is_internal: false, mentions: [], created_at: new Date('2026-04-07T10:00:00Z'), updated_at: new Date('2026-04-07T10:00:00Z') },
    { id: seededUuid('comment', 'CMT-112'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-019'), author_id: u('USR-102'), body: 'Charts are rendering correctly now. Appreciate the fix.', is_internal: false, mentions: [], created_at: new Date('2026-04-09T09:00:00Z'), updated_at: new Date('2026-04-09T09:00:00Z') },
    // Additional comments for TKT-020
    { id: seededUuid('comment', 'CMT-120'), tenant_id: t('ORG-003'), ticket_id: seededUuid('ticket', 'TKT-020'), author_id: u('USR-103'), body: 'Multiple users have reported this. The 15-minute window is too short for enterprise environments with email delays.', is_internal: false, mentions: [], created_at: new Date('2026-03-19T10:00:00Z'), updated_at: new Date('2026-03-19T10:00:00Z') },
    { id: seededUuid('comment', 'CMT-121'), tenant_id: t('ORG-003'), ticket_id: seededUuid('ticket', 'TKT-020'), author_id: u('USR-003'), body: 'Agreed. I have submitted a PR to increase the default expiry to 60 minutes and make it configurable per tenant.', is_internal: false, mentions: [], created_at: new Date('2026-03-20T11:00:00Z'), updated_at: new Date('2026-03-20T11:00:00Z') },
    { id: seededUuid('comment', 'CMT-122'), tenant_id: t('ORG-003'), ticket_id: seededUuid('ticket', 'TKT-020'), author_id: u('USR-103'), body: 'Thanks — when will this be deployed?', is_internal: false, mentions: [], created_at: new Date('2026-03-21T09:00:00Z'), updated_at: new Date('2026-03-21T09:00:00Z') },
    // Additional comments for TKT-024
    { id: seededUuid('comment', 'CMT-130'), tenant_id: t('ORG-006'), ticket_id: seededUuid('ticket', 'TKT-024'), author_id: u('USR-103'), body: 'Please resend to accounts@apexlogistics.com.', is_internal: false, mentions: [], created_at: new Date('2026-04-02T10:00:00Z'), updated_at: new Date('2026-04-02T10:00:00Z') },
    { id: seededUuid('comment', 'CMT-131'), tenant_id: t('ORG-006'), ticket_id: seededUuid('ticket', 'TKT-024'), author_id: u('USR-003'), body: 'Resent. You should receive it within 5 minutes. Apologies for the delay.', is_internal: false, mentions: [], created_at: new Date('2026-04-02T11:00:00Z'), updated_at: new Date('2026-04-02T11:00:00Z') },
  ];

  for (const comment of commentsData) {
    await prisma.comment.create({ data: comment as any });
  }
  console.log(`✅ Created ${commentsData.length} comments`);


  // ═══════════════════════════════════════════════════════════════════════════
  // 9. KB CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════════
  const kbCatData = [
    // ORG-001 categories
    { id: seededUuid('kbcat', 'KBCAT-001'), tenant_id: t('ORG-001'), name: 'Getting Started',    slug: 'getting-started',    description: 'First steps for new users — submitting tickets, navigating the portal, and basic configuration.' },
    { id: seededUuid('kbcat', 'KBCAT-002'), tenant_id: t('ORG-001'), name: 'Account & Security', slug: 'account-security',   description: 'Managing your profile, two-factor authentication, SSO, and team members.' },
    { id: seededUuid('kbcat', 'KBCAT-003'), tenant_id: t('ORG-001'), name: 'Billing & Plans',    slug: 'billing-plans',      description: 'Invoices, payment methods, subscription upgrades, and usage limits.' },
    { id: seededUuid('kbcat', 'KBCAT-004'), tenant_id: t('ORG-001'), name: 'Tickets & SLAs',     slug: 'tickets-slas',       description: 'Ticket lifecycle, statuses, attachments, comments, SLA policies, and breach alerts.' },
    { id: seededUuid('kbcat', 'KBCAT-005'), tenant_id: t('ORG-001'), name: 'Integrations',       slug: 'integrations',       description: 'Connecting Meridian to Slack, Jira, GitHub, and other third-party tools.' },
    { id: seededUuid('kbcat', 'KBCAT-006'), tenant_id: t('ORG-001'), name: 'Reports & Exports',  slug: 'reports-exports',    description: 'Exporting data, understanding analytics dashboards, and scheduled reports.' },
    // ORG-002 (Acme Corporation) — same categories mirrored
    { id: seededUuid('kbcat', 'KBCAT-101'), tenant_id: t('ORG-002'), name: 'Getting Started',    slug: 'getting-started',    description: 'First steps for new users — submitting tickets, navigating the portal, and basic configuration.' },
    { id: seededUuid('kbcat', 'KBCAT-102'), tenant_id: t('ORG-002'), name: 'Account & Security', slug: 'account-security',   description: 'Managing your profile, two-factor authentication, SSO, and team members.' },
    { id: seededUuid('kbcat', 'KBCAT-103'), tenant_id: t('ORG-002'), name: 'Billing & Plans',    slug: 'billing-plans',      description: 'Invoices, payment methods, subscription upgrades, and usage limits.' },
    { id: seededUuid('kbcat', 'KBCAT-104'), tenant_id: t('ORG-002'), name: 'Tickets & SLAs',     slug: 'tickets-slas',       description: 'Ticket lifecycle, statuses, attachments, comments, SLA policies, and breach alerts.' },
    { id: seededUuid('kbcat', 'KBCAT-105'), tenant_id: t('ORG-002'), name: 'Integrations',       slug: 'integrations',       description: 'Connecting Meridian to Slack, Jira, GitHub, and other third-party tools.' },
    { id: seededUuid('kbcat', 'KBCAT-106'), tenant_id: t('ORG-002'), name: 'Reports & Exports',  slug: 'reports-exports',    description: 'Exporting data, understanding analytics dashboards, and scheduled reports.' },
  ];

  for (const cat of kbCatData) {
    await prisma.kbCategory.create({ data: cat });
  }
  console.log(`✅ Created ${kbCatData.length} KB categories`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. KB ARTICLES
  // ═══════════════════════════════════════════════════════════════════════════
  // shorthand refs for category IDs
  const kbCat = {
    gettingStarted:  seededUuid('kbcat', 'KBCAT-001'),
    accountSecurity: seededUuid('kbcat', 'KBCAT-002'),
    billing:         seededUuid('kbcat', 'KBCAT-003'),
    tickets:         seededUuid('kbcat', 'KBCAT-004'),
    integrations:    seededUuid('kbcat', 'KBCAT-005'),
    reports:         seededUuid('kbcat', 'KBCAT-006'),
  };

  const kbArticlesData = [
    {
      id: seededUuid('kb', 'KBA-001'), tenant_id: t('ORG-001'),
      slug: 'how-to-create-your-first-support-ticket',
      category_id: kbCat.gettingStarted, author_id: u('USR-001'),
      tags: ['getting-started', 'tickets', 'submit', 'new-ticket'],
      related_article_ids: [seededUuid('kb', 'KBA-002'), seededUuid('kb', 'KBA-008')],
      title: 'How to create your first support ticket',
      excerpt: 'Step-by-step guide to submitting a support request and setting the right priority so our team can help you faster.',
      content: `Creating a support ticket is the fastest way to get help from our team. Follow these steps to submit your first request.\n\n## Step 1 — Log in to the Customer Portal\n\nNavigate to your organisation's Meridian portal and sign in with your credentials.\n\n## Step 2 — Click "New Ticket"\n\nFrom the Dashboard, click the **New Ticket** button in the top-right corner.\n\n## Step 3 — Fill in the details\n\n- **Subject** — Write a clear, specific title.\n- **Description** — Explain what you expected to happen and what actually happened.\n- **Priority** — Choose the impact level: Low, Medium, High, Critical.\n- **Category** — Pick the closest match.\n\n## Step 4 — Attach files (optional)\n\nScreenshots, logs, or recordings help our agents resolve your issue faster.\n\n## Step 5 — Submit\n\nClick **Submit Ticket**. You'll receive a confirmation email with your ticket number.`,
      status: 'published', published_at: new Date('2025-09-01T09:00:00Z'), view_count: 1842, helpful_count: 314,
      created_at: new Date('2025-09-01T09:00:00Z'), updated_at: new Date('2026-03-15T11:20:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-002'), tenant_id: t('ORG-001'),
      slug: 'understanding-ticket-statuses',
      category_id: kbCat.tickets, author_id: u('USR-001'),
      tags: ['tickets', 'status', 'open', 'resolved', 'closed', 'lifecycle'],
      related_article_ids: [seededUuid('kb', 'KBA-001'), seededUuid('kb', 'KBA-012')],
      title: 'Understanding ticket statuses and what they mean',
      excerpt: 'A breakdown of every ticket status — Open, Acknowledged, In Progress, Resolved, and Closed — and what action is needed from you.',
      content: `Each ticket in Meridian moves through a defined lifecycle. Here's what every status means and what you should do at each stage.\n\n## Open\nYour ticket has been received and is in the queue.\n\n## Acknowledged\nAn agent has read your ticket and confirmed it's been understood.\n\n## In Progress\nActive work is underway.\n\n## Resolved\nOur agent believes the issue has been fixed. You have **72 hours** to confirm.\n\n## Closed\nThe ticket is complete. You can reopen a closed ticket within 30 days.`,
      status: 'published', published_at: new Date('2025-09-05T10:00:00Z'), view_count: 1203, helpful_count: 198,
      created_at: new Date('2025-09-05T10:00:00Z'), updated_at: new Date('2026-02-20T08:45:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-003'), tenant_id: t('ORG-001'),
      slug: 'how-to-invite-team-members',
      category_id: kbCat.accountSecurity, author_id: u('USR-002'),
      tags: ['team', 'invite', 'members', 'admin', 'organisation'],
      related_article_ids: [seededUuid('kb', 'KBA-004')],
      title: 'How to invite team members to your organisation',
      excerpt: 'CLIENT_ADMIN users can invite colleagues via email. Invited users receive a setup link valid for 48 hours.',
      content: `If you're a Client Admin, you can invite colleagues to join your organisation in Meridian.\n\n## Requirements\n- You must have the **Client Admin** role.\n\n## Steps to invite\n1. Navigate to **Team Management**.\n2. Click **Invite Member**.\n3. Enter the person's email address.\n4. Click **Send Invite**.\n\nThe invitee receives an email with a secure setup link. The link expires after **48 hours**.`,
      status: 'published', published_at: new Date('2025-09-10T12:00:00Z'), view_count: 876, helpful_count: 142,
      created_at: new Date('2025-09-10T12:00:00Z'), updated_at: new Date('2026-01-18T09:00:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-004'), tenant_id: t('ORG-001'),
      slug: 'setting-up-two-factor-authentication',
      category_id: kbCat.accountSecurity, author_id: u('USR-002'),
      tags: ['2fa', 'security', 'totp', 'authenticator', 'mfa'],
      related_article_ids: [seededUuid('kb', 'KBA-011'), seededUuid('kb', 'KBA-003')],
      title: 'Setting up two-factor authentication (2FA)',
      excerpt: 'Secure your account with TOTP-based 2FA using apps like Google Authenticator or Authy.',
      content: `Two-factor authentication adds a second layer of security to your Meridian account.\n\n## Supported authenticator apps\n- Google Authenticator\n- Authy\n- Microsoft Authenticator\n- 1Password\n\n## How to enable 2FA\n1. Go to your **Account Settings**.\n2. Under **Security**, click **Enable Two-Factor Authentication**.\n3. Scan the QR code with your authenticator app.\n4. Enter the 6-digit code from your app to confirm setup.\n5. Save your **backup codes** in a secure location.`,
      status: 'published', published_at: new Date('2025-10-01T08:00:00Z'), view_count: 654, helpful_count: 103,
      created_at: new Date('2025-10-01T08:00:00Z'), updated_at: new Date('2026-03-01T14:00:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-005'), tenant_id: t('ORG-001'),
      slug: 'how-to-download-or-reprint-an-invoice',
      category_id: kbCat.billing, author_id: u('USR-003'),
      tags: ['billing', 'invoice', 'download', 'pdf', 'receipt'],
      related_article_ids: [seededUuid('kb', 'KBA-006'), seededUuid('kb', 'KBA-007')],
      title: 'How to download or reprint an invoice',
      excerpt: 'Find and download PDF invoices for any billing period from the Billing section of your Organisation Settings.',
      content: `All invoices for your Meridian subscription are available as downloadable PDFs directly from the portal.\n\n## Accessing invoices\n1. Navigate to **Organisation Settings → Billing**.\n2. Scroll to the **Invoice History** section.\n3. Click the **Download PDF** button next to any invoice.\n\nInvoices are generated on the 1st of each month for the previous billing period.`,
      status: 'published', published_at: new Date('2025-09-15T10:00:00Z'), view_count: 921, helpful_count: 187,
      created_at: new Date('2025-09-15T10:00:00Z'), updated_at: new Date('2026-02-10T10:30:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-006'), tenant_id: t('ORG-001'),
      slug: 'upgrading-or-downgrading-your-subscription-plan',
      category_id: kbCat.billing, author_id: u('USR-003'),
      tags: ['billing', 'plan', 'upgrade', 'downgrade', 'subscription'],
      related_article_ids: [seededUuid('kb', 'KBA-005'), seededUuid('kb', 'KBA-007')],
      title: 'Upgrading or downgrading your subscription plan',
      excerpt: 'Change your plan at any time from Organisation Settings. Upgrades take effect immediately; downgrades at the next renewal date.',
      content: `Meridian offers four plans: **Starter**, **Growth**, **Business**, and **Enterprise**.\n\n## Upgrading\nUpgrades take effect **immediately**. You'll be charged a prorated amount.\n\n## Downgrading\nDowngrades are scheduled for the **next renewal date**.\n\n## What happens to my data?\n- Data is never deleted when downgrading.\n- Features not available on the lower plan will be locked.`,
      status: 'published', published_at: new Date('2025-10-10T09:00:00Z'), view_count: 743, helpful_count: 121,
      created_at: new Date('2025-10-10T09:00:00Z'), updated_at: new Date('2026-01-25T11:00:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-007'), tenant_id: t('ORG-001'),
      slug: 'updating-your-payment-method',
      category_id: kbCat.billing, author_id: u('USR-003'),
      tags: ['billing', 'payment', 'credit-card', 'bank-transfer', 'sepa'],
      related_article_ids: [seededUuid('kb', 'KBA-005'), seededUuid('kb', 'KBA-006')],
      title: 'Updating your payment method',
      excerpt: 'Replace a credit card or switch to bank transfer from the Billing tab in Organisation Settings.',
      content: `You can update your payment method at any time without interrupting your service.\n\n## Supported payment methods\n- Credit / debit cards (Visa, Mastercard, Amex)\n- SEPA Direct Debit (EU accounts)\n- Bank transfer (Enterprise accounts only)\n\n## How to update your card\n1. Go to **Organisation Settings → Billing**.\n2. Under **Payment Method**, click **Update Card**.\n3. Enter your new card details.\n4. Click **Save**.`,
      status: 'published', published_at: new Date('2025-11-01T10:00:00Z'), view_count: 589, helpful_count: 94,
      created_at: new Date('2025-11-01T10:00:00Z'), updated_at: new Date('2026-03-05T09:00:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-008'), tenant_id: t('ORG-001'),
      slug: 'how-to-add-attachments-to-a-ticket',
      category_id: kbCat.tickets, author_id: u('USR-001'),
      tags: ['attachments', 'files', 'upload', 'screenshots', 'logs', 'tickets'],
      related_article_ids: [seededUuid('kb', 'KBA-001'), seededUuid('kb', 'KBA-009')],
      title: 'How to add attachments to a ticket',
      excerpt: 'Upload screenshots, logs, or documents directly to a ticket. Supported formats include PNG, JPG, PDF, and ZIP up to 25MB each.',
      content: `Attachments help our agents understand your issue faster.\n\n## During ticket creation\nOn the New Ticket form, drag and drop files onto the attachment area.\n\n## Supported file types\n- Images: PNG, JPG, GIF, WebP\n- Documents: PDF, DOCX, XLSX, CSV\n- Archives: ZIP, TAR.GZ\n- Logs: TXT, LOG\n\n## Size limits\n- Max 25MB per file\n- Max 100MB total per ticket`,
      status: 'published', published_at: new Date('2025-09-20T08:00:00Z'), view_count: 1102, helpful_count: 211,
      created_at: new Date('2025-09-20T08:00:00Z'), updated_at: new Date('2026-02-28T10:00:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-009'), tenant_id: t('ORG-001'),
      slug: 'using-mentions-in-ticket-comments',
      category_id: kbCat.tickets, author_id: u('USR-001'),
      tags: ['comments', 'mentions', 'collaboration', 'notifications', 'tickets'],
      related_article_ids: [seededUuid('kb', 'KBA-008')],
      title: 'Using @mentions in ticket comments',
      excerpt: 'Tag agents or teammates in comments with @name to notify them directly and keep conversations focused.',
      content: `@mentions let you directly notify a specific person in a ticket comment.\n\n## How to mention someone\nWhile typing a comment, type **@** followed by the person's name.\n\n## Who can you mention?\n- Any member of your organisation or any agent assigned to your ticket.\n- Internal notes allow agents to mention colleagues without the customer seeing.`,
      status: 'published', published_at: new Date('2025-10-15T11:00:00Z'), view_count: 678, helpful_count: 134,
      created_at: new Date('2025-10-15T11:00:00Z'), updated_at: new Date('2026-01-10T12:00:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-010'), tenant_id: t('ORG-001'),
      slug: 'connecting-meridian-to-slack',
      category_id: kbCat.integrations, author_id: u('USR-002'),
      tags: ['slack', 'integration', 'notifications', 'channels', 'connect'],
      related_article_ids: [],
      title: 'Connecting Meridian to Slack',
      excerpt: 'Receive ticket notifications directly in Slack channels and respond to updates without leaving Slack.',
      content: `The Meridian Slack integration sends real-time ticket notifications to your chosen Slack channels.\n\n## Prerequisites\n- You must be a **Client Admin** or internal **Admin**.\n\n## Setting up\n1. Go to **Organisation Settings → Integrations**.\n2. Click **Connect** next to Slack.\n3. Choose the default channel for ticket notifications.\n4. Click **Save**.`,
      status: 'published', published_at: new Date('2025-11-10T09:00:00Z'), view_count: 512, helpful_count: 88,
      created_at: new Date('2025-11-10T09:00:00Z'), updated_at: new Date('2026-02-15T10:00:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-011'), tenant_id: t('ORG-001'),
      slug: 'sso-and-saml-configuration-guide',
      category_id: kbCat.accountSecurity, author_id: u('USR-002'),
      tags: ['sso', 'saml', 'azure-ad', 'okta', 'google-workspace', 'authentication'],
      related_article_ids: [seededUuid('kb', 'KBA-004')],
      title: 'SSO and SAML configuration guide',
      excerpt: 'This guide covers setting up SAML 2.0 single sign-on with Azure AD, Okta, and Google Workspace.',
      content: `This guide covers setting up SAML 2.0 single sign-on with Azure AD, Okta, and Google Workspace.\n\n## Azure AD\n1. Create an Enterprise Application in Azure AD.\n2. Download the Federation Metadata XML.\n3. Upload it to Meridian under **Security → SSO**.\n4. Map user attributes (email, firstName, lastName).\n5. Enable SSO and test with a non-admin account.`,
      status: 'published', published_at: new Date('2025-12-01T10:00:00Z'), view_count: 445, helpful_count: 72,
      created_at: new Date('2025-12-01T10:00:00Z'), updated_at: new Date('2026-03-20T11:00:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-012'), tenant_id: t('ORG-001'),
      slug: 'understanding-sla-policies-and-breach-alerts',
      category_id: kbCat.tickets, author_id: u('USR-001'),
      tags: ['sla', 'breach', 'response-time', 'resolution', 'alerts', 'policy'],
      related_article_ids: [seededUuid('kb', 'KBA-002')],
      title: 'Understanding SLA policies and breach alerts',
      excerpt: 'Service Level Agreements define how quickly we respond to and resolve your tickets. Learn about breach alerts.',
      content: `Service Level Agreements (SLAs) define how quickly we respond to and resolve your tickets.\n\n## Response SLA\nThe time within which an agent first responds to your ticket.\n\n## Resolution SLA\nThe time within which your ticket is resolved.\n\n## Breach alerts\nYou will receive email and in-app notifications when an SLA is at risk or has been breached.`,
      status: 'published', published_at: new Date('2026-01-15T09:00:00Z'), view_count: 398, helpful_count: 61,
      created_at: new Date('2026-01-15T09:00:00Z'), updated_at: new Date('2026-04-01T10:00:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-013'), tenant_id: t('ORG-001'),
      slug: 'exporting-data-and-reports',
      category_id: kbCat.reports, author_id: u('USR-003'),
      tags: ['export', 'reports', 'csv', 'excel', 'analytics', 'data'],
      related_article_ids: [],
      title: 'Exporting data and reports',
      excerpt: 'You can export tickets, analytics, and audit logs in CSV or Excel format. Learn how to use the export features.',
      content: `You can export tickets, analytics, and audit logs in CSV or Excel format.\n\n## Ticket exports\nNavigate to Tickets → Export. Select filters and click Download.\n\n## Analytics exports\nOn any chart, click the download icon in the top-right corner.`,
      status: 'published', published_at: new Date('2026-02-20T10:00:00Z'), view_count: 267, helpful_count: 45,
      created_at: new Date('2026-02-20T10:00:00Z'), updated_at: new Date('2026-04-05T09:00:00Z'),
    },
    // ── ORG-002 (Acme Corporation) articles ──────────────────────────────────
    {
      id: seededUuid('kb', 'KBA-101'), tenant_id: t('ORG-002'),
      slug: 'how-to-submit-a-support-ticket',
      category_id: seededUuid('kbcat', 'KBCAT-101'), author_id: u('USR-001'),
      tags: ['getting-started', 'tickets', 'submit'],
      related_article_ids: [],
      title: 'How to submit a support ticket',
      excerpt: 'Learn how to create your first support ticket and track its progress from the customer portal.',
      content: `To submit a support ticket:\n\n1. Click **New Ticket** in the top navigation.\n2. Enter a clear title describing the issue.\n3. Select the priority and category.\n4. Attach any relevant screenshots or files.\n5. Click **Submit**.\n\nYou will receive a confirmation email with your ticket number. You can track the status from the **My Tickets** page.`,
      status: 'published', published_at: new Date('2026-01-10T09:00:00Z'), view_count: 520, helpful_count: 88,
      created_at: new Date('2026-01-10T09:00:00Z'), updated_at: new Date('2026-04-01T10:00:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-102'), tenant_id: t('ORG-002'),
      slug: 'understanding-ticket-priorities',
      category_id: seededUuid('kbcat', 'KBCAT-104'), author_id: u('USR-001'),
      tags: ['tickets', 'priority', 'sla', 'urgent'],
      related_article_ids: [],
      title: 'Understanding ticket priorities and SLA',
      excerpt: 'Ticket priority determines how quickly the support team responds. Learn what each priority level means.',
      content: `## Priority Levels\n\n- **Urgent** — System down, major business impact. Response within 15 minutes.\n- **High** — Core feature broken, significant impact. Response within 1 hour.\n- **Medium** — Issue affecting some users, workaround available. Response within 4 hours.\n- **Low** — Minor issue or question. Response within 8 hours.\n\n## Changing Priority\nYou can request a priority change by commenting on your ticket. An agent will review and adjust if appropriate.`,
      status: 'published', published_at: new Date('2026-01-12T09:00:00Z'), view_count: 340, helpful_count: 54,
      created_at: new Date('2026-01-12T09:00:00Z'), updated_at: new Date('2026-04-02T10:00:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-103'), tenant_id: t('ORG-002'),
      slug: 'managing-your-team-members',
      category_id: seededUuid('kbcat', 'KBCAT-102'), author_id: u('USR-001'),
      tags: ['team', 'users', 'permissions', 'admin'],
      related_article_ids: [],
      title: 'Managing your team members',
      excerpt: 'As a Client Admin, you can invite team members, assign roles, and manage permissions for your organisation.',
      content: `## Inviting Team Members\n\nGo to **Settings → Team** and click **Invite Member**. Enter their email address and select a role:\n\n- **Client Admin** — Can manage team, view all tickets, and configure settings.\n- **Client User** — Can create and view their own tickets.\n\n## Removing a Member\nClick the member's name and select **Deactivate**. Their tickets remain visible but they cannot log in.`,
      status: 'published', published_at: new Date('2026-01-15T09:00:00Z'), view_count: 210, helpful_count: 38,
      created_at: new Date('2026-01-15T09:00:00Z'), updated_at: new Date('2026-04-03T10:00:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-104'), tenant_id: t('ORG-002'),
      slug: 'viewing-invoices-and-billing',
      category_id: seededUuid('kbcat', 'KBCAT-103'), author_id: u('USR-001'),
      tags: ['billing', 'invoices', 'payment', 'subscription'],
      related_article_ids: [],
      title: 'Viewing invoices and billing history',
      excerpt: 'Find all your invoices and payment history under Settings → Billing. Download PDF copies at any time.',
      content: `## Accessing Billing\n\nNavigate to **Settings → Billing** to view:\n\n- Current subscription plan\n- Payment method on file\n- Invoice history (downloadable as PDF)\n\n## Updating Payment Method\nClick **Update Payment Method** and enter your new card details. Changes take effect on the next billing cycle.\n\n## Questions?\nRaise a ticket under the **Billing** category and our team will respond within 4 hours.`,
      status: 'published', published_at: new Date('2026-01-18T09:00:00Z'), view_count: 180, helpful_count: 29,
      created_at: new Date('2026-01-18T09:00:00Z'), updated_at: new Date('2026-04-04T10:00:00Z'),
    },
    {
      id: seededUuid('kb', 'KBA-105'), tenant_id: t('ORG-002'),
      slug: 'resetting-your-password',
      category_id: seededUuid('kbcat', 'KBCAT-102'), author_id: u('USR-001'),
      tags: ['password', 'security', 'login', 'account'],
      related_article_ids: [],
      title: 'Resetting your password',
      excerpt: 'Forgot your password? Follow these steps to reset it and regain access to your account.',
      content: `## Steps to Reset Your Password\n\n1. On the login page, click **Forgot password?**\n2. Enter your registered email address.\n3. Check your inbox for a reset link (valid for 1 hour).\n4. Click the link and enter a new password.\n\n## Password Requirements\n- Minimum 8 characters\n- At least one uppercase letter\n- At least one number\n\n## Still locked out?\nContact your Client Admin or raise a support ticket.`,
      status: 'published', published_at: new Date('2026-01-20T09:00:00Z'), view_count: 430, helpful_count: 71,
      created_at: new Date('2026-01-20T09:00:00Z'), updated_at: new Date('2026-04-05T10:00:00Z'),
    },
  ];

  for (const article of kbArticlesData) {
    await prisma.kbArticle.create({ data: article as any });
  }
  console.log(`✅ Created ${kbArticlesData.length} KB articles`);


  // ═══════════════════════════════════════════════════════════════════════════
  // 11. DELIVERY ITEMS  (mapped from Delivery Features)
  // ═══════════════════════════════════════════════════════════════════════════
  const deliveryItemsData = [
    { id: seededUuid('delivery', 'DF-001'), tenant_id: t('ORG-001'), title: 'SLA Breach Alerts', description: 'Real-time notifications when tickets are approaching or have breached SLA thresholds.', status: 'released', priority: 'high', assignee_id: u('USR-002'), due_date: new Date('2026-02-28T00:00:00Z'), created_at: new Date('2025-11-01T00:00:00Z'), updated_at: new Date('2026-02-28T00:00:00Z') },
    { id: seededUuid('delivery', 'DF-002'), tenant_id: t('ORG-001'), title: 'AI Ticket Suggestions', description: 'AI-powered reply suggestions, auto-classification, and routing recommendations surfaced in the ticket workspace.', status: 'released', priority: 'high', assignee_id: u('USR-003'), due_date: new Date('2026-03-15T00:00:00Z'), created_at: new Date('2025-10-15T00:00:00Z'), updated_at: new Date('2026-03-15T00:00:00Z') },
    { id: seededUuid('delivery', 'DF-003'), tenant_id: t('ORG-001'), title: 'Client Roadmap View', description: 'Public-facing product roadmap for client portal users to see upcoming features, vote on priorities, and submit feature requests.', status: 'in_qa', priority: 'high', assignee_id: u('USR-002'), due_date: new Date('2026-04-30T00:00:00Z'), created_at: new Date('2026-01-10T00:00:00Z'), updated_at: new Date('2026-04-10T00:00:00Z') },
    { id: seededUuid('delivery', 'DF-004'), tenant_id: t('ORG-001'), title: 'Onboarding Tracker', description: 'Structured phase-by-phase onboarding tracker visible to both internal team and client admin.', status: 'in_qa', priority: 'medium', assignee_id: u('USR-001'), due_date: new Date('2026-04-25T00:00:00Z'), created_at: new Date('2026-01-20T00:00:00Z'), updated_at: new Date('2026-04-12T00:00:00Z') },
    { id: seededUuid('delivery', 'DF-005'), tenant_id: t('ORG-001'), title: 'Delivery Board Kanban', description: 'Internal Kanban board for tracking feature delivery with drag-and-drop and AI prioritisation.', status: 'in_progress', priority: 'medium', assignee_id: u('USR-003'), due_date: new Date('2026-05-10T00:00:00Z'), created_at: new Date('2026-02-01T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('delivery', 'DF-006'), tenant_id: t('ORG-001'), title: 'Advanced Analytics Dashboard', description: 'Expanded analytics with trend charts, agent performance tables, SLA heatmaps, and exportable reports.', status: 'in_progress', priority: 'high', assignee_id: u('USR-002'), due_date: new Date('2026-05-20T00:00:00Z'), created_at: new Date('2026-01-05T00:00:00Z'), updated_at: new Date('2026-04-14T00:00:00Z') },
    { id: seededUuid('delivery', 'DF-007'), tenant_id: t('ORG-001'), title: 'Custom Branding Themes', description: 'Allow client admins to set their organisation logo, accent colour, and email template styles.', status: 'planned', priority: 'low', assignee_id: u('USR-001'), due_date: new Date('2026-06-15T00:00:00Z'), created_at: new Date('2026-02-15T00:00:00Z'), updated_at: new Date('2026-03-20T00:00:00Z') },
    { id: seededUuid('delivery', 'DF-008'), tenant_id: t('ORG-001'), title: 'Two-Factor Authentication', description: 'TOTP-based 2FA for all internal users. Optional enforcement per organisation for client portal users.', status: 'planned', priority: 'high', assignee_id: u('USR-003'), due_date: new Date('2026-06-30T00:00:00Z'), created_at: new Date('2026-01-28T00:00:00Z'), updated_at: new Date('2026-03-10T00:00:00Z') },
    { id: seededUuid('delivery', 'DF-009'), tenant_id: t('ORG-001'), title: 'Bulk Ticket Actions', description: 'Select multiple tickets and apply bulk status changes, reassignments, or priority updates.', status: 'backlog', priority: 'medium', assignee_id: null, due_date: null, created_at: new Date('2026-03-01T00:00:00Z'), updated_at: new Date('2026-03-01T00:00:00Z') },
    { id: seededUuid('delivery', 'DF-010'), tenant_id: t('ORG-001'), title: 'Webhook Integrations', description: 'Outbound webhooks on ticket lifecycle events to integrate with Jira, Slack, or custom pipelines.', status: 'backlog', priority: 'medium', assignee_id: null, due_date: null, created_at: new Date('2026-02-20T00:00:00Z'), updated_at: new Date('2026-02-20T00:00:00Z') },
    { id: seededUuid('delivery', 'DF-011'), tenant_id: t('ORG-001'), title: 'AI Knowledge Base Auto-Draft', description: 'After a ticket is resolved, AI drafts a KB article from the conversation thread.', status: 'backlog', priority: 'low', assignee_id: null, due_date: null, created_at: new Date('2026-03-10T00:00:00Z'), updated_at: new Date('2026-03-10T00:00:00Z') },
    { id: seededUuid('delivery', 'DF-012'), tenant_id: t('ORG-001'), title: 'Mobile App (iOS & Android)', description: 'Native mobile apps for client portal users to submit tickets, view updates, and receive push notifications.', status: 'backlog', priority: 'high', assignee_id: null, due_date: null, created_at: new Date('2026-01-15T00:00:00Z'), updated_at: new Date('2026-01-15T00:00:00Z') },
  ];

  for (const item of deliveryItemsData) {
    await prisma.deliveryItem.create({ data: item as any });
  }
  console.log(`✅ Created ${deliveryItemsData.length} delivery items`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. ONBOARDING ITEMS
  // ═══════════════════════════════════════════════════════════════════════════
  const onboardingItemsData = [
    // ONB-001 — Acme Corp
    { id: seededUuid('onb', 'TSK-001'), tenant_id: t('ORG-001'), title: 'Kick-off call completed', description: 'Initial discovery call with key stakeholders.', status: 'done', assignee_id: u('USR-002'), due_date: new Date('2026-03-10T00:00:00Z'), created_at: new Date('2026-03-10T00:00:00Z'), updated_at: new Date('2026-03-10T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-002'), tenant_id: t('ORG-001'), title: 'Environment provisioned', description: 'Sandbox and production environments created and credentials shared.', status: 'done', assignee_id: u('USR-002'), due_date: new Date('2026-03-14T00:00:00Z'), created_at: new Date('2026-03-13T00:00:00Z'), updated_at: new Date('2026-03-13T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-003'), tenant_id: t('ORG-001'), title: 'SSO configuration', description: 'SAML SSO integrated with Acme Corp identity provider.', status: 'done', assignee_id: u('USR-102'), due_date: new Date('2026-03-18T00:00:00Z'), created_at: new Date('2026-03-17T00:00:00Z'), updated_at: new Date('2026-03-17T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-004'), tenant_id: t('ORG-001'), title: 'Legacy ticket export', description: 'Export all historical tickets from previous system as CSV.', status: 'done', assignee_id: u('USR-103'), due_date: new Date('2026-04-05T00:00:00Z'), created_at: new Date('2026-04-04T00:00:00Z'), updated_at: new Date('2026-04-04T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-005'), tenant_id: t('ORG-001'), title: 'Data mapping & transformation', description: 'Map legacy fields to Meridian schema, handle custom fields.', status: 'in_progress', assignee_id: u('USR-002'), due_date: new Date('2026-04-20T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-006'), tenant_id: t('ORG-001'), title: 'Dry-run import', description: 'Import to sandbox, validate counts and field accuracy.', status: 'pending', assignee_id: u('USR-002'), due_date: new Date('2026-04-28T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-007'), tenant_id: t('ORG-001'), title: 'Client sign-off on migrated data', description: 'Client reviews sample records and confirms accuracy.', status: 'pending', assignee_id: u('USR-102'), due_date: new Date('2026-05-02T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-008'), tenant_id: t('ORG-001'), title: 'UAT test plan review', description: 'Review and approve UAT scenarios covering core workflows.', status: 'pending', assignee_id: u('USR-102'), due_date: new Date('2026-05-05T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-009'), tenant_id: t('ORG-001'), title: 'Training session - admin users', description: 'Live walkthrough for client admin users covering settings and reporting.', status: 'pending', assignee_id: u('USR-002'), due_date: new Date('2026-05-12T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-010'), tenant_id: t('ORG-001'), title: 'Training session - end users', description: 'Self-paced video and live Q&A for client end users.', status: 'pending', assignee_id: u('USR-002'), due_date: new Date('2026-05-16T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-011'), tenant_id: t('ORG-001'), title: 'Final production import', description: 'Execute full data migration to production environment.', status: 'pending', assignee_id: u('USR-002'), due_date: new Date('2026-05-26T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-012'), tenant_id: t('ORG-001'), title: 'DNS cutover', description: 'Update DNS records to point to Meridian portal.', status: 'pending', assignee_id: u('USR-102'), due_date: new Date('2026-05-28T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-013'), tenant_id: t('ORG-001'), title: 'Go-live sign-off', description: 'Formal client sign-off and hypercare period begins.', status: 'pending', assignee_id: u('USR-102'), due_date: new Date('2026-05-30T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    // ONB-002 — Beta Industries
    { id: seededUuid('onb', 'TSK-014'), tenant_id: t('ORG-001'), title: 'Kick-off call completed', description: 'Initial discovery call with Beta Industries IT and ops teams.', status: 'done', assignee_id: u('USR-003'), due_date: new Date('2026-03-05T00:00:00Z'), created_at: new Date('2026-03-05T00:00:00Z'), updated_at: new Date('2026-03-05T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-015'), tenant_id: t('ORG-001'), title: 'Environment provisioned', description: 'Sandbox environment created, credentials delivered.', status: 'done', assignee_id: u('USR-003'), due_date: new Date('2026-03-08T00:00:00Z'), created_at: new Date('2026-03-09T00:00:00Z'), updated_at: new Date('2026-03-09T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-016'), tenant_id: t('ORG-001'), title: 'SSO configuration', description: 'SAML SSO integrated with Beta Industries identity provider.', status: 'in_progress', assignee_id: u('USR-103'), due_date: new Date('2026-03-15T00:00:00Z'), created_at: new Date('2026-03-10T00:00:00Z'), updated_at: new Date('2026-03-10T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-017'), tenant_id: t('ORG-001'), title: 'Data migration plan', description: 'Define scope of historical data to migrate.', status: 'pending', assignee_id: u('USR-003'), due_date: new Date('2026-03-20T00:00:00Z'), created_at: new Date('2026-03-10T00:00:00Z'), updated_at: new Date('2026-03-10T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-018'), tenant_id: t('ORG-001'), title: 'UAT environment setup', description: 'Create UAT environment with sample data.', status: 'blocked', assignee_id: u('USR-003'), due_date: new Date('2026-03-25T00:00:00Z'), created_at: new Date('2026-03-10T00:00:00Z'), updated_at: new Date('2026-03-10T00:00:00Z') },
    // ORG-002 — Acme Corporation (david.wilson — client portal user)
    { id: seededUuid('onb', 'TSK-101'), tenant_id: t('ORG-002'), title: 'Kick-off call completed', description: 'Initial discovery call with key stakeholders.', status: 'done', assignee_id: u('USR-002'), due_date: new Date('2026-03-10T00:00:00Z'), created_at: new Date('2026-03-10T00:00:00Z'), updated_at: new Date('2026-03-10T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-102'), tenant_id: t('ORG-002'), title: 'Environment provisioned', description: 'Sandbox and production environments created and credentials shared.', status: 'done', assignee_id: u('USR-002'), due_date: new Date('2026-03-14T00:00:00Z'), created_at: new Date('2026-03-13T00:00:00Z'), updated_at: new Date('2026-03-13T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-103'), tenant_id: t('ORG-002'), title: 'SSO configuration', description: 'SAML SSO integrated with your identity provider.', status: 'done', assignee_id: u('USR-101'), due_date: new Date('2026-03-18T00:00:00Z'), created_at: new Date('2026-03-17T00:00:00Z'), updated_at: new Date('2026-03-17T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-104'), tenant_id: t('ORG-002'), title: 'Legacy ticket export', description: 'Export all historical tickets from your previous system.', status: 'done', assignee_id: u('USR-101'), due_date: new Date('2026-04-05T00:00:00Z'), created_at: new Date('2026-04-04T00:00:00Z'), updated_at: new Date('2026-04-04T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-105'), tenant_id: t('ORG-002'), title: 'Data mapping & transformation', description: 'Our team is mapping your legacy fields to the Meridian schema.', status: 'in_progress', assignee_id: u('USR-002'), due_date: new Date('2026-04-20T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-106'), tenant_id: t('ORG-002'), title: 'Dry-run import', description: 'Import to sandbox environment for your review.', status: 'pending', assignee_id: u('USR-002'), due_date: new Date('2026-04-28T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-107'), tenant_id: t('ORG-002'), title: 'Confirm migrated data', description: 'Review sample records and confirm accuracy.', status: 'pending', assignee_id: u('USR-101'), due_date: new Date('2026-05-02T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-108'), tenant_id: t('ORG-002'), title: 'UAT test plan review', description: 'Review and approve UAT scenarios covering your core workflows.', status: 'pending', assignee_id: u('USR-101'), due_date: new Date('2026-05-05T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-109'), tenant_id: t('ORG-002'), title: 'Training session - admin users', description: 'Live walkthrough for your admin users.', status: 'pending', assignee_id: u('USR-002'), due_date: new Date('2026-05-12T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-110'), tenant_id: t('ORG-002'), title: 'Training session - end users', description: 'Self-paced video and live Q&A for your team.', status: 'pending', assignee_id: u('USR-002'), due_date: new Date('2026-05-16T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-111'), tenant_id: t('ORG-002'), title: 'Final production import', description: 'Full data migration to your production environment.', status: 'pending', assignee_id: u('USR-002'), due_date: new Date('2026-05-26T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-112'), tenant_id: t('ORG-002'), title: 'DNS cutover', description: 'Update your DNS records to point to the Meridian portal.', status: 'pending', assignee_id: u('USR-101'), due_date: new Date('2026-05-28T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('onb', 'TSK-113'), tenant_id: t('ORG-002'), title: 'Go-live sign-off', description: 'Formal sign-off and hypercare period begins.', status: 'pending', assignee_id: u('USR-101'), due_date: new Date('2026-05-30T00:00:00Z'), created_at: new Date('2026-04-15T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
  ];

  for (const item of onboardingItemsData) {
    await prisma.onboardingItem.create({ data: item as any });
  }
  console.log(`✅ Created ${onboardingItemsData.length} onboarding items`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. ROADMAP FEATURES
  // ═══════════════════════════════════════════════════════════════════════════
  const roadmapFeaturesData = [
    { id: seededUuid('roadmap', 'RF-001'), tenant_id: t('ORG-001'), title: 'SLA Breach Alerts', description: 'Real-time notifications when tickets are approaching or have breached SLA thresholds.', status: 'released', votes: 34, created_by: u('USR-002'), created_at: new Date('2025-11-01T00:00:00Z'), updated_at: new Date('2026-02-28T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-002'), tenant_id: t('ORG-001'), title: 'AI Ticket Suggestions', description: 'AI-powered reply suggestions, auto-classification, and routing recommendations.', status: 'released', votes: 52, created_by: u('USR-003'), created_at: new Date('2025-10-15T00:00:00Z'), updated_at: new Date('2026-03-15T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-003'), tenant_id: t('ORG-001'), title: 'Client Roadmap View', description: 'Public-facing product roadmap for client portal users.', status: 'planned', votes: 41, created_by: u('USR-002'), created_at: new Date('2026-01-10T00:00:00Z'), updated_at: new Date('2026-04-10T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-004'), tenant_id: t('ORG-001'), title: 'Onboarding Tracker', description: 'Structured phase-by-phase onboarding tracker.', status: 'planned', votes: 28, created_by: u('USR-001'), created_at: new Date('2026-01-20T00:00:00Z'), updated_at: new Date('2026-04-12T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-005'), tenant_id: t('ORG-001'), title: 'Delivery Board Kanban', description: 'Internal Kanban board for tracking feature delivery.', status: 'planned', votes: 19, created_by: u('USR-003'), created_at: new Date('2026-02-01T00:00:00Z'), updated_at: new Date('2026-04-15T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-006'), tenant_id: t('ORG-001'), title: 'Advanced Analytics Dashboard', description: 'Expanded analytics with trend charts and SLA heatmaps.', status: 'planned', votes: 37, created_by: u('USR-002'), created_at: new Date('2026-01-05T00:00:00Z'), updated_at: new Date('2026-04-14T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-007'), tenant_id: t('ORG-001'), title: 'Custom Branding Themes', description: 'Allow client admins to set their organisation logo and accent colour.', status: 'planned', votes: 22, created_by: u('USR-001'), created_at: new Date('2026-02-15T00:00:00Z'), updated_at: new Date('2026-03-20T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-008'), tenant_id: t('ORG-001'), title: 'Two-Factor Authentication', description: 'TOTP-based 2FA for all internal users.', status: 'planned', votes: 45, created_by: u('USR-003'), created_at: new Date('2026-01-28T00:00:00Z'), updated_at: new Date('2026-03-10T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-009'), tenant_id: t('ORG-001'), title: 'Bulk Ticket Actions', description: 'Select multiple tickets and apply bulk status changes.', status: 'planned', votes: 18, created_by: null, created_at: new Date('2026-03-01T00:00:00Z'), updated_at: new Date('2026-03-01T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-010'), tenant_id: t('ORG-001'), title: 'Webhook Integrations', description: 'Outbound webhooks on ticket lifecycle events.', status: 'planned', votes: 31, created_by: null, created_at: new Date('2026-02-20T00:00:00Z'), updated_at: new Date('2026-02-20T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-011'), tenant_id: t('ORG-001'), title: 'AI Knowledge Base Auto-Draft', description: 'After a ticket is resolved, AI drafts a KB article from the conversation thread.', status: 'planned', votes: 26, created_by: null, created_at: new Date('2026-03-10T00:00:00Z'), updated_at: new Date('2026-03-10T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-012'), tenant_id: t('ORG-001'), title: 'Mobile App (iOS & Android)', description: 'Native mobile apps for client portal users.', status: 'planned', votes: 63, created_by: null, created_at: new Date('2026-01-15T00:00:00Z'), updated_at: new Date('2026-01-15T00:00:00Z') },
    // ORG-002 — Acme Corporation (client-visible roadmap)
    { id: seededUuid('roadmap', 'RF-101'), tenant_id: t('ORG-002'), title: 'SLA Breach Alerts', description: 'Real-time notifications when tickets approach or breach SLA thresholds.', status: 'released', votes: 34, created_by: u('USR-002'), created_at: new Date('2025-11-01T00:00:00Z'), updated_at: new Date('2026-02-28T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-102'), tenant_id: t('ORG-002'), title: 'AI Ticket Suggestions', description: 'AI-powered reply suggestions, auto-classification, and routing in the ticket workspace.', status: 'released', votes: 52, created_by: u('USR-003'), created_at: new Date('2025-10-15T00:00:00Z'), updated_at: new Date('2026-03-15T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-103'), tenant_id: t('ORG-002'), title: 'Client Roadmap View', description: 'Public-facing product roadmap for client portal users to see upcoming features and vote.', status: 'in_staging', votes: 41, created_by: u('USR-002'), created_at: new Date('2026-01-10T00:00:00Z'), updated_at: new Date('2026-04-10T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-104'), tenant_id: t('ORG-002'), title: 'Onboarding Tracker', description: 'Phase-by-phase onboarding tracker visible to both internal team and client admin.', status: 'in_qa', votes: 28, created_by: u('USR-001'), created_at: new Date('2026-01-20T00:00:00Z'), updated_at: new Date('2026-04-12T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-105'), tenant_id: t('ORG-002'), title: 'Advanced Analytics Dashboard', description: 'Expanded analytics with trend charts, agent performance tables, SLA heatmaps, and exportable reports.', status: 'in_dev', votes: 37, created_by: u('USR-002'), created_at: new Date('2026-01-05T00:00:00Z'), updated_at: new Date('2026-04-14T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-106'), tenant_id: t('ORG-002'), title: 'Custom Branding Themes', description: 'Allow client admins to set their organisation logo, accent colour, and email template styles.', status: 'planned', votes: 22, created_by: u('USR-001'), created_at: new Date('2026-02-15T00:00:00Z'), updated_at: new Date('2026-03-20T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-107'), tenant_id: t('ORG-002'), title: 'Two-Factor Authentication', description: 'TOTP-based 2FA for all users. Optional enforcement per organisation via workspace settings.', status: 'planned', votes: 45, created_by: u('USR-003'), created_at: new Date('2026-01-28T00:00:00Z'), updated_at: new Date('2026-03-10T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-108'), tenant_id: t('ORG-002'), title: 'Webhook Integrations', description: 'Outbound webhooks on ticket lifecycle events for your internal tooling.', status: 'planned', votes: 31, created_by: null, created_at: new Date('2026-02-20T00:00:00Z'), updated_at: new Date('2026-02-20T00:00:00Z') },
    { id: seededUuid('roadmap', 'RF-109'), tenant_id: t('ORG-002'), title: 'Mobile App (iOS & Android)', description: 'Native mobile apps for client portal users.', status: 'planned', votes: 63, created_by: null, created_at: new Date('2026-01-15T00:00:00Z'), updated_at: new Date('2026-01-15T00:00:00Z') },
  ];

  for (const feature of roadmapFeaturesData) {
    await prisma.roadmapFeature.create({ data: feature as any });
  }
  console.log(`✅ Created ${roadmapFeaturesData.length} roadmap features`);


  // ═══════════════════════════════════════════════════════════════════════════
  // 14. ESCALATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const escalationsData = [
    { id: seededUuid('esc', 'ESC-001'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-004'), reason: 'SLA breach imminent', status: 'open', escalated_to: u('USR-002'), resolved_at: null, created_at: new Date('2026-04-17T08:30:00Z') },
    { id: seededUuid('esc', 'ESC-002'), tenant_id: t('ORG-001'), ticket_id: seededUuid('ticket', 'TKT-012'), reason: 'Customer impact on prod', status: 'open', escalated_to: u('USR-002'), resolved_at: null, created_at: new Date('2026-04-17T06:00:00Z') },
    { id: seededUuid('esc', 'ESC-003'), tenant_id: t('ORG-003'), ticket_id: seededUuid('ticket', 'TKT-021'), reason: 'Data integrity risk', status: 'open', escalated_to: u('USR-003'), resolved_at: null, created_at: new Date('2026-04-17T04:05:00Z') },
    { id: seededUuid('esc', 'ESC-004'), tenant_id: t('ORG-002'), ticket_id: seededUuid('ticket', 'TKT-025'), reason: 'Blocking client workflow', status: 'open', escalated_to: u('USR-006'), resolved_at: null, created_at: new Date('2026-04-17T02:30:00Z') },
  ];

  for (const esc of escalationsData) {
    await prisma.escalation.create({ data: esc });
  }
  console.log(`✅ Created ${escalationsData.length} escalations`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. ROUTING RULES
  // ═══════════════════════════════════════════════════════════════════════════
  const routingRulesData = [
    { id: seededUuid('rr', 'RR-001'), tenant_id: t('ORG-001'), name: 'Critical → Lead Agent', condition: { field: 'priority', operator: 'in', value: ['CRITICAL', 'HIGH'] }, action: { assignTo: u('USR-002') }, priority: 1, is_active: true, created_at: new Date('2025-06-01T00:00:00Z'), updated_at: new Date('2025-06-01T00:00:00Z') },
    { id: seededUuid('rr', 'RR-002'), tenant_id: t('ORG-001'), name: 'Billing → James Okafor', condition: { field: 'category', operator: 'equals', value: 'BILLING' }, action: { assignTo: u('USR-003') }, priority: 2, is_active: true, created_at: new Date('2025-08-01T00:00:00Z'), updated_at: new Date('2025-08-01T00:00:00Z') },
    { id: seededUuid('rr', 'RR-003'), tenant_id: t('ORG-001'), name: 'Unassigned → Round Robin', condition: { field: 'assignedTo', operator: 'equals', value: null }, action: { assignTo: u('USR-003') }, priority: 10, is_active: true, created_at: new Date('2025-09-01T00:00:00Z'), updated_at: new Date('2025-09-01T00:00:00Z') },
    { id: seededUuid('rr', 'RR-004'), tenant_id: t('ORG-001'), name: 'Incident → Nina Patel', condition: { field: 'category', operator: 'equals', value: 'INCIDENT' }, action: { assignTo: u('USR-006') }, priority: 3, is_active: true, created_at: new Date('2026-04-14T11:00:00Z'), updated_at: new Date('2026-04-14T11:00:00Z') },
    { id: seededUuid('rr', 'RR-005'), tenant_id: t('ORG-001'), name: 'Global Finance — SLA Override', condition: { field: 'organizationId', operator: 'equals', value: t('ORG-004') }, action: { assignTo: u('USR-006') }, priority: 5, is_active: false, created_at: new Date('2026-02-01T00:00:00Z'), updated_at: new Date('2026-02-01T00:00:00Z') },
  ];

  for (const rule of routingRulesData) {
    await prisma.routingRule.create({ data: rule as any });
  }
  console.log(`✅ Created ${routingRulesData.length} routing rules`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const notificationsData = [
    { id: seededUuid('notif', 'NOT-001'), tenant_id: t('ORG-001'), user_id: u('USR-002'), type: 'SLA_BREACHED', title: 'SLA Breached — TKT-001', body: 'Ticket TKT-001 "Production database cluster unresponsive" has breached its resolution SLA.', data: { ticketId: 'TKT-001' }, is_read: false, read_at: null, created_at: new Date('2026-04-16T07:45:00Z') },
    { id: seededUuid('notif', 'NOT-002'), tenant_id: t('ORG-001'), user_id: u('USR-003'), type: 'TICKET_ASSIGNED', title: 'New ticket assigned to you', body: 'TKT-002 "Payment processing failing for all Stripe transactions" has been assigned to you.', data: { ticketId: 'TKT-002' }, is_read: false, read_at: null, created_at: new Date('2026-04-16T14:33:00Z') },
    { id: seededUuid('notif', 'NOT-003'), tenant_id: t('ORG-001'), user_id: u('USR-002'), type: 'TICKET_MENTION', title: 'You were mentioned in TKT-002', body: 'James Okafor mentioned you in an internal note on TKT-002.', data: { ticketId: 'TKT-002' }, is_read: false, read_at: null, created_at: new Date('2026-04-16T15:02:00Z') },
    { id: seededUuid('notif', 'NOT-004'), tenant_id: t('ORG-001'), user_id: u('USR-002'), type: 'SLA_AT_RISK', title: 'SLA At Risk — TKT-003', body: 'Ticket TKT-003 "SSO/SAML login broken for Azure AD users" resolution SLA is at risk. 2h 15min remaining.', data: { ticketId: 'TKT-003' }, is_read: true, read_at: new Date('2026-04-16T08:00:00Z'), created_at: new Date('2026-04-16T07:45:00Z') },
    { id: seededUuid('notif', 'NOT-005'), tenant_id: t('ORG-001'), user_id: u('USR-001'), type: 'TICKET_COMMENT', title: 'New comment on TKT-022', body: 'Priya Sharma left an internal note on TKT-022 "Onboarding: Sunrise Healthcare".', data: { ticketId: 'TKT-022' }, is_read: true, read_at: new Date('2026-04-16T08:00:00Z'), created_at: new Date('2026-04-16T07:55:00Z') },
    { id: seededUuid('notif', 'NOT-006'), tenant_id: t('ORG-001'), user_id: u('USR-003'), type: 'TICKET_STATUS_CHANGED', title: 'TKT-016 marked as Resolved', body: 'Ticket TKT-016 "How do I export SLA compliance data?" has been resolved.', data: { ticketId: 'TKT-016' }, is_read: true, read_at: new Date('2026-04-12T11:00:00Z'), created_at: new Date('2026-04-12T10:00:00Z') },
    { id: seededUuid('notif', 'NOT-007'), tenant_id: t('ORG-001'), user_id: u('USR-004'), type: 'TICKET_ASSIGNED', title: 'New ticket assigned to you', body: 'TKT-009 "Bulk ticket reassignment fails with 50+ tickets" has been assigned to you.', data: { ticketId: 'TKT-009' }, is_read: false, read_at: null, created_at: new Date('2026-04-16T07:10:00Z') },
    { id: seededUuid('notif', 'NOT-008'), tenant_id: t('ORG-001'), user_id: u('USR-001'), type: 'SYSTEM', title: 'New Enterprise client onboarded', body: 'Sunrise Healthcare (ORG-007) has been provisioned. Onboarding ticket TKT-022 is in progress.', data: { organizationId: 'ORG-007' }, is_read: true, read_at: new Date('2026-04-14T10:00:00Z'), created_at: new Date('2026-04-14T09:05:00Z') },
  ];

  for (const notif of notificationsData) {
    await prisma.notification.create({ data: notif as any });
  }
  console.log(`✅ Created ${notificationsData.length} notifications`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════════════════
  const auditLogsData = [
    { id: seededUuid('audit', 'AUD-001'), tenant_id: t('ORG-001'), user_id: u('USR-001'), action: 'UPDATE', resource_type: 'user', resource_id: u('USR-007'), changes: { role: { from: 'AGENT', to: 'LEAD' } }, ip_address: '192.168.1.45', created_at: new Date('2026-04-16T08:30:00Z') },
    { id: seededUuid('audit', 'AUD-002'), tenant_id: t('ORG-002'), user_id: u('USR-002'), action: 'STATUS_CHANGE', resource_type: 'ticket', resource_id: seededUuid('ticket', 'TKT-001'), changes: { status: { from: 'ACKNOWLEDGED', to: 'IN_PROGRESS' } }, ip_address: '10.0.0.12', created_at: new Date('2026-04-16T09:15:00Z') },
    { id: seededUuid('audit', 'AUD-003'), tenant_id: t('ORG-003'), user_id: u('USR-002'), action: 'ASSIGN', resource_type: 'ticket', resource_id: seededUuid('ticket', 'TKT-006'), changes: { assignedTo: { from: null, to: 'USR-008' } }, ip_address: '10.0.0.12', created_at: new Date('2026-04-16T11:02:00Z') },
    { id: seededUuid('audit', 'AUD-004'), tenant_id: t('ORG-001'), user_id: u('USR-001'), action: 'UPDATE', resource_type: 'organization', resource_id: t('ORG-005'), changes: { isActive: { from: true, to: false } }, ip_address: '192.168.1.45', created_at: new Date('2026-04-15T16:00:00Z') },
    { id: seededUuid('audit', 'AUD-005'), tenant_id: t('ORG-001'), user_id: u('USR-006'), action: 'UPDATE', resource_type: 'routing_rule', resource_id: seededUuid('rr', 'RR-001'), changes: { condition: { from: 'priority = CRITICAL', to: 'priority IN (CRITICAL, HIGH)' } }, ip_address: '10.0.0.88', created_at: new Date('2026-04-15T14:30:00Z') },
    { id: seededUuid('audit', 'AUD-006'), tenant_id: t('ORG-001'), user_id: u('USR-001'), action: 'CREATE', resource_type: 'user', resource_id: u('USR-008'), changes: { role: { from: null, to: 'AGENT' }, email: { from: null, to: 'yuki.tanaka@3sc.com' } }, ip_address: '192.168.1.45', created_at: new Date('2026-04-15T09:00:00Z') },
    { id: seededUuid('audit', 'AUD-007'), tenant_id: t('ORG-002'), user_id: u('USR-004'), action: 'STATUS_CHANGE', resource_type: 'ticket', resource_id: seededUuid('ticket', 'TKT-018'), changes: { status: { from: 'IN_PROGRESS', to: 'RESOLVED' } }, ip_address: '10.0.0.55', created_at: new Date('2026-04-11T16:00:00Z') },
    { id: seededUuid('audit', 'AUD-008'), tenant_id: t('ORG-001'), user_id: u('USR-001'), action: 'DELETE', resource_type: 'user', resource_id: u('USR-007'), changes: { isActive: { from: true, to: false } }, ip_address: '192.168.1.45', created_at: new Date('2026-01-10T11:00:00Z') },
    { id: seededUuid('audit', 'AUD-009'), tenant_id: t('ORG-001'), user_id: u('USR-006'), action: 'UPDATE', resource_type: 'ticket', resource_id: seededUuid('ticket', 'TKT-023'), changes: { priority: { from: 'LOW', to: 'MEDIUM' }, assignedTo: { from: null, to: 'USR-001' } }, ip_address: '10.0.0.88', created_at: new Date('2026-04-15T14:05:00Z') },
    { id: seededUuid('audit', 'AUD-010'), tenant_id: t('ORG-001'), user_id: u('USR-001'), action: 'LOGIN', resource_type: 'user', resource_id: u('USR-001'), changes: null, ip_address: '192.168.1.45', created_at: new Date('2026-04-16T08:14:00Z') },
    { id: seededUuid('audit', 'AUD-011'), tenant_id: t('ORG-001'), user_id: u('USR-002'), action: 'CREATE', resource_type: 'routing_rule', resource_id: seededUuid('rr', 'RR-004'), changes: { name: { from: null, to: 'Billing → Billing Queue' }, isActive: { from: null, to: true } }, ip_address: '10.0.0.12', created_at: new Date('2026-04-14T11:00:00Z') },
    { id: seededUuid('audit', 'AUD-012'), tenant_id: t('ORG-001'), user_id: u('USR-001'), action: 'UPDATE', resource_type: 'organization', resource_id: t('ORG-002'), changes: { plan: { from: 'Pro', to: 'Business' } }, ip_address: '192.168.1.45', created_at: new Date('2026-03-01T10:00:00Z') },
  ];

  for (const log of auditLogsData) {
    await prisma.auditLog.create({ data: log as any });
  }
  console.log(`✅ Created ${auditLogsData.length} audit logs`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. PERMISSION OVERRIDES
  // ═══════════════════════════════════════════════════════════════════════════
  const permissionOverridesData = [
    { id: seededUuid('perm', 'PO-001'), tenant_id: t('ORG-001'), user_id: u('USR-004'), permission: 'TICKET_ASSIGN', type: OverrideType.GRANT, granted_by: u('USR-001'), created_at: new Date('2026-03-15T10:00:00Z') },
    { id: seededUuid('perm', 'PO-002'), tenant_id: t('ORG-002'), user_id: u('USR-101'), permission: 'DELIVERY_VIEW', type: OverrideType.GRANT, granted_by: u('USR-001'), created_at: new Date('2026-02-20T09:00:00Z') },
  ];

  for (const po of permissionOverridesData) {
    await prisma.permissionOverride.create({ data: po });
  }
  console.log(`✅ Created ${permissionOverridesData.length} permission overrides`);

  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
