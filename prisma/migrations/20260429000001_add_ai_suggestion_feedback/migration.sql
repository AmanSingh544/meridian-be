-- CreateTable
CREATE TABLE "ai_suggestion_feedback" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "suggestion_id" TEXT         NOT NULL,
    "ticket_id"     UUID         NOT NULL,
    "type"          TEXT         NOT NULL,
    "action"        TEXT         NOT NULL,
    "agent_id"      UUID,
    "reason"        TEXT,
    "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_suggestion_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_suggestion_feedback_suggestion_id_idx" ON "ai_suggestion_feedback"("suggestion_id");
