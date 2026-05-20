/**
 * CSAT Demo Seed — seeds survey tokens and feedback responses for demo.
 * Run: node seed_csat.js
 * Safe to re-run (upsert pattern via deleteMany + create)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// From the main seed — ORG-001 = 3SC internal tenant, ORG-002 = Acme Corp
const ORG_001 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // 3SC Internal
const ORG_002 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'; // Acme Corporation
const ORG_003 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'; // Beta Industries
const USR_002 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02'; // sarah.chen (delivery lead)

const now = new Date();

function daysAgo(d) {
  return new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
}

const responses = [
  // ─── ORG-002 Acme Corp responses ─────────────────────────────
  {
    tenant_id: ORG_002, customer_email: 'david.wilson@acme.com', customer_name: 'David Wilson',
    selected_modules: ['IBP', 'AI/ML'],
    csat_score: 5, overall_value: 4, expectation_met: 'exceeded', overall_comment: 'The platform has significantly improved our supply chain visibility.',
    ease_of_use: 4, feature_coverage: 5, ai_ml_quality: 5, customization: 4, performance: 4, ibp_accuracy: 5,
    top_feature: 'AI-powered demand forecasting', product_comment: 'IBP accuracy has been a game changer for us.',
    impl_smoothness: 4, training_quality: 5, impl_timeline: 'on_time', time_to_value: '1_3_months', integration_quality: 4,
    support_responsiveness: 5, support_quality: 5, account_mgmt: 5, proactive_comm: 4, preferred_channel: 'portal',
    visibility_improvement: 5, kpi_improvement: 'significant', roi_satisfaction: 5, renew_intent: 'definitely_renew',
    nps_score: 10, recommend_reason: 'Best supply chain platform we have used. Transformed our operations.',
    open_feedback: 'Keep investing in the AI capabilities. Would love mobile app support.',
    sentiment: 'positive', theme: 'Highly Satisfied', is_flagged: false,
    created_at: daysAgo(5),
  },
  {
    tenant_id: ORG_002, customer_email: 'rachel.kim@acme.com', customer_name: 'Rachel Kim',
    selected_modules: ['IBP', 'ITMS'],
    csat_score: 4, overall_value: 4, expectation_met: 'met', overall_comment: 'Solid platform overall.',
    ease_of_use: 4, feature_coverage: 4, ai_ml_quality: 4, performance: 3, ibp_accuracy: 4, itms_quality: 4,
    impl_smoothness: 3, training_quality: 4, impl_timeline: 'slightly_delayed', time_to_value: '3_6_months',
    support_responsiveness: 4, support_quality: 4, account_mgmt: 4, proactive_comm: 3,
    visibility_improvement: 4, kpi_improvement: 'moderate', roi_satisfaction: 4, renew_intent: 'likely_renew',
    nps_score: 8, recommend_reason: 'Good platform, minor performance issues occasionally.',
    open_feedback: 'Would like faster load times on the analytics dashboard.',
    sentiment: 'positive', theme: 'Performance', is_flagged: false,
    created_at: daysAgo(12),
  },
  {
    tenant_id: ORG_002, customer_email: 'mark.jones@acme.com', customer_name: 'Mark Jones',
    selected_modules: ['WMS', 'ITMS'],
    csat_score: 2, overall_value: 2, expectation_met: 'partially_met', overall_comment: 'Integration has been painful.',
    ease_of_use: 3, feature_coverage: 3, itms_quality: 2, wms_quality: 2, performance: 2,
    impl_smoothness: 2, training_quality: 3, impl_timeline: 'significantly_delayed', integration_quality: 2,
    impl_comment: 'The API integrations took 3x longer than estimated.',
    support_responsiveness: 2, support_quality: 3, proactive_comm: 2,
    visibility_improvement: 2, roi_satisfaction: 2, renew_intent: 'unsure',
    nps_score: 4, recommend_reason: 'Integration issues need to be resolved before I can recommend.',
    open_feedback: 'The WMS integration with our ERP is broken. Still waiting for a fix after 6 weeks.',
    sentiment: 'negative', theme: 'Integration', is_flagged: true,
    created_at: daysAgo(20),
  },

  // ─── ORG-003 Beta Industries ──────────────────────────────────
  {
    tenant_id: ORG_003, customer_email: 'alice.hayes@beta-ind.com', customer_name: 'Alice Hayes',
    selected_modules: ['IBP', 'CarbonX', 'AI/ML'],
    csat_score: 5, overall_value: 5, expectation_met: 'exceeded',
    ease_of_use: 5, feature_coverage: 5, ai_ml_quality: 5, carbonx_quality: 5, ibp_accuracy: 5, performance: 5,
    top_feature: 'Carbon reporting dashboard',
    impl_smoothness: 5, training_quality: 5, impl_timeline: 'ahead', time_to_value: '1_3_months',
    support_responsiveness: 5, support_quality: 5, account_mgmt: 5, proactive_comm: 5,
    visibility_improvement: 5, kpi_improvement: 'significant', roi_satisfaction: 5, renew_intent: 'definitely_renew',
    nps_score: 10, recommend_reason: 'Absolutely outstanding. Ahead of every competitor.',
    open_feedback: null, sentiment: 'positive', theme: 'Highly Satisfied', is_flagged: false,
    created_at: daysAgo(3),
  },
  {
    tenant_id: ORG_003, customer_email: 'james.okonkwo@beta-ind.com', customer_name: 'James Okonkwo',
    selected_modules: ['IBP', 'AI/ML'],
    csat_score: 3, overall_value: 3, expectation_met: 'partially_met', overall_comment: 'Mixed experience so far.',
    ease_of_use: 3, feature_coverage: 3, ai_ml_quality: 4, performance: 3, ibp_accuracy: 3,
    impl_smoothness: 3, training_quality: 3, impl_timeline: 'on_time', time_to_value: '3_6_months',
    support_responsiveness: 3, support_quality: 3, account_mgmt: 3, proactive_comm: 2,
    visibility_improvement: 3, kpi_improvement: 'slight', roi_satisfaction: 3, renew_intent: 'unsure',
    nps_score: 6, recommend_reason: 'Need to see more improvements before recommending.',
    open_feedback: 'Dashboard is hard to navigate. Need better UX for non-technical users.',
    sentiment: 'neutral', theme: 'Usability', is_flagged: false,
    created_at: daysAgo(15),
  },
  {
    tenant_id: ORG_003, customer_email: 'sarah.burns@beta-ind.com', customer_name: 'Sarah Burns',
    selected_modules: ['IBP'],
    csat_score: 4, overall_value: 4, expectation_met: 'met',
    ease_of_use: 4, feature_coverage: 4, ibp_accuracy: 4, performance: 4, ai_ml_quality: 3,
    impl_smoothness: 4, training_quality: 5, impl_timeline: 'on_time',
    support_responsiveness: 5, support_quality: 5, account_mgmt: 4,
    visibility_improvement: 4, kpi_improvement: 'moderate', roi_satisfaction: 4, renew_intent: 'likely_renew',
    nps_score: 8,
    open_feedback: 'Support team is excellent. Product keeps improving.',
    sentiment: 'positive', theme: 'Support', is_flagged: false,
    created_at: daysAgo(8),
  },
  // Older entries for trend data
  {
    tenant_id: ORG_002, customer_email: 'old1@acme.com', customer_name: 'Tom Bradley',
    selected_modules: ['IBP', 'ITMS'],
    csat_score: 4, nps_score: 7, sentiment: 'positive', theme: 'General Feedback', is_flagged: false,
    overall_value: 4, ease_of_use: 4, performance: 4,
    created_at: daysAgo(35),
  },
  {
    tenant_id: ORG_002, customer_email: 'old2@acme.com', customer_name: 'Emily Carter',
    selected_modules: ['WMS'],
    csat_score: 3, nps_score: 5, sentiment: 'neutral', theme: 'Usability', is_flagged: false,
    ease_of_use: 3, feature_coverage: 3,
    created_at: daysAgo(42),
  },
  {
    tenant_id: ORG_003, customer_email: 'old3@beta-ind.com', customer_name: 'Lucas Marsh',
    selected_modules: ['IBP', 'AI/ML'],
    csat_score: 5, nps_score: 9, sentiment: 'positive', theme: 'Highly Satisfied', is_flagged: false,
    ease_of_use: 5, feature_coverage: 5, ai_ml_quality: 5,
    created_at: daysAgo(28),
  },
];

async function run() {
  // Verify tenants exist
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: [ORG_002, ORG_003] } },
    select: { id: true, name: true },
  });

  if (tenants.length === 0) {
    console.error('ERROR: No tenants found. Run the main seed first.');
    process.exit(1);
  }
  console.log('Tenants found:', tenants.map(t => t.name).join(', '));

  // Clear existing CSAT data for these tenants
  const deleted = await prisma.feedbackResponse.deleteMany({
    where: { tenant_id: { in: [ORG_002, ORG_003] } },
  });
  console.log(`Cleared ${deleted.count} existing feedback responses`);

  const tokensDeleted = await prisma.surveyToken.deleteMany({
    where: { tenant_id: { in: [ORG_002, ORG_003] } },
  });
  console.log(`Cleared ${tokensDeleted.count} existing survey tokens`);

  // Create sample feedback responses
  for (const r of responses) {
    await prisma.feedbackResponse.create({ data: r });
  }
  console.log(`Created ${responses.length} feedback responses`);

  // Create some sample survey tokens (pending + used)
  const tokens = [
    { tenant_id: ORG_002, customer_email: 'ceo@acme.com', customer_name: 'Jennifer Walsh', company_name: 'Acme Corporation', created_by: USR_002, expires_at: new Date(Date.now() + 25 * 86400000) },
    { tenant_id: ORG_002, customer_email: 'ops@acme.com', customer_name: 'Kevin Park', company_name: 'Acme Corporation', created_by: USR_002, expires_at: new Date(Date.now() + 20 * 86400000) },
    { tenant_id: ORG_003, customer_email: 'cto@beta-ind.com', customer_name: 'Diana Chen', company_name: 'Beta Industries', created_by: USR_002, expires_at: new Date(Date.now() + 28 * 86400000) },
    { tenant_id: ORG_003, customer_email: 'procurement@beta-ind.com', customer_name: 'Oliver Smith', company_name: 'Beta Industries', created_by: USR_002, expires_at: new Date(Date.now() - 5 * 86400000) }, // expired
  ];

  for (const t of tokens) {
    await prisma.surveyToken.create({ data: t });
  }
  console.log(`Created ${tokens.length} survey tokens`);

  console.log('\n✅ CSAT demo seed complete!');
  console.log('\nSummary:');
  console.log(`  - ${responses.length} feedback responses across ORG-002 (Acme) and ORG-003 (Beta Industries)`);
  console.log(`  - ${tokens.length} survey tokens (2 pending, 1 pending, 1 expired)`);
  console.log('\nTo create a live survey link, go to the CSAT dashboard → Survey Links tab.');
}

run()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
