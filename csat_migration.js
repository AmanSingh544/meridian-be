const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const statements = [
  `ALTER TABLE "feedback_responses" DROP COLUMN IF EXISTS "customer_segment"`,
  `ALTER TABLE "feedback_responses" DROP COLUMN IF EXISTS "module"`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "account_mgmt" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "ai_ml_quality" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "carbonx_quality" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "customer_email" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "customer_name" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "customization" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "ease_of_use" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "expectation_met" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "feature_coverage" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "ibp_accuracy" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "impl_comment" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "impl_smoothness" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "impl_timeline" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "integration_quality" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "itms_quality" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "kpi_improvement" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "open_feedback" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "overall_comment" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "overall_value" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "performance" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "preferred_channel" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "proactive_comm" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "product_comment" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "recommend_reason" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "renew_intent" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "roi_satisfaction" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "selected_modules" TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "support_comment" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "support_quality" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "support_responsiveness" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "survey_token_id" UUID`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "time_to_value" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "top_feature" TEXT`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "training_quality" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "visibility_improvement" INTEGER`,
  `ALTER TABLE "feedback_responses" ADD COLUMN IF NOT EXISTS "wms_quality" INTEGER`,
  `CREATE TABLE IF NOT EXISTS "survey_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_name" TEXT,
    "company_name" TEXT,
    "created_by" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "response_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "survey_tokens_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "survey_tokens_tenant_id_created_at_idx" ON "survey_tokens"("tenant_id", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "survey_tokens_customer_email_idx" ON "survey_tokens"("customer_email")`,
  `CREATE INDEX IF NOT EXISTS "feedback_responses_tenant_id_nps_score_idx" ON "feedback_responses"("tenant_id", "nps_score")`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'survey_tokens_tenant_id_fkey'
    ) THEN
      ALTER TABLE "survey_tokens" ADD CONSTRAINT "survey_tokens_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`,
];

async function run() {
  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 70);
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log('OK:', preview);
    } catch (e) {
      console.error('FAIL:', preview, '\n  ->', e.message);
      process.exit(1);
    }
  }

  // Regenerate Prisma client
  console.log('\nAll statements applied. Run: npx prisma generate');
  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
