-- CreateTable
CREATE TABLE "feedback_responses" (
    "id"               UUID         NOT NULL,
    "tenant_id"        UUID         NOT NULL,
    "project_id"       UUID,
    "csat_score"       INTEGER,
    "nps_score"        INTEGER,
    "sentiment"        TEXT         NOT NULL DEFAULT 'neutral',
    "theme"            TEXT,
    "module"           TEXT,
    "customer_segment" TEXT,
    "is_flagged"       BOOLEAN      NOT NULL DEFAULT false,
    "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_responses_tenant_id_created_at_idx" ON "feedback_responses"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "feedback_responses_tenant_id_sentiment_idx" ON "feedback_responses"("tenant_id", "sentiment");

-- CreateIndex
CREATE INDEX "feedback_responses_tenant_id_theme_idx" ON "feedback_responses"("tenant_id", "theme");

-- AddForeignKey
ALTER TABLE "feedback_responses" ADD CONSTRAINT "feedback_responses_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
