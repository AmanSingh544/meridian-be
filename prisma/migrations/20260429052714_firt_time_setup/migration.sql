/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "kb_articles" DROP CONSTRAINT IF EXISTS "kb_articles_author_id_fkey";

-- DropForeignKey
ALTER TABLE "kb_articles" DROP CONSTRAINT IF EXISTS "kb_articles_category_fk";

-- DropForeignKey
ALTER TABLE "kb_categories" DROP CONSTRAINT IF EXISTS "kb_categories_parent_fk";

-- DropForeignKey
ALTER TABLE "kb_categories" DROP CONSTRAINT IF EXISTS "kb_categories_tenant_fk";

-- DropIndex
DROP INDEX IF EXISTS "kb_articles_content_trgm_idx";

-- DropIndex
DROP INDEX IF EXISTS "kb_articles_content_vector_idx";

-- DropIndex
DROP INDEX IF EXISTS "kb_articles_excerpt_trgm_idx";

-- DropIndex
DROP INDEX IF EXISTS "kb_articles_search_vector_idx";

-- DropIndex
DROP INDEX IF EXISTS "kb_articles_tags_idx";

-- DropIndex
DROP INDEX IF EXISTS "kb_articles_title_trgm_idx";

-- DropIndex
DROP INDEX IF EXISTS "users_tenant_id_email_key";

-- AlterTable
ALTER TABLE "ai_suggestion_feedback" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "kb_categories" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "ai_suggestion_feedback_ticket_id_type_idx" ON "ai_suggestion_feedback"("ticket_id", "type");

-- CreateIndex
CREATE INDEX "kb_articles_tenant_id_tags_idx" ON "kb_articles"("tenant_id", "tags");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_email_idx" ON "users"("tenant_id", "email");

-- AddForeignKey
ALTER TABLE "kb_categories" ADD CONSTRAINT "kb_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_categories" ADD CONSTRAINT "kb_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "kb_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "kb_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "kb_articles_tenant_category_idx" RENAME TO "kb_articles_tenant_id_category_id_idx";

-- RenameIndex
ALTER INDEX "kb_articles_tenant_slug_key" RENAME TO "kb_articles_tenant_id_slug_key";

-- RenameIndex
ALTER INDEX "kb_categories_tenant_idx" RENAME TO "kb_categories_tenant_id_idx";

-- RenameIndex
ALTER INDEX "kb_categories_tenant_slug_key" RENAME TO "kb_categories_tenant_id_slug_key";
