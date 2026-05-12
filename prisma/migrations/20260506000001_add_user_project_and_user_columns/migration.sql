-- Migration: add_user_project_and_user_columns
-- 1. Remove old global email unique constraint
-- 2. Add new columns to users
-- 3. Add per-tenant email unique constraint
-- 4. Create UserProject table + ProjectRole enum

-- Step 1: Drop old global unique constraint on email
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";

-- Step 2: Add new profile columns to users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "internal_sub_role" TEXT,
  ADD COLUMN IF NOT EXISTS "department"         TEXT,
  ADD COLUMN IF NOT EXISTS "job_title"          TEXT,
  ADD COLUMN IF NOT EXISTS "phone"              TEXT,
  ADD COLUMN IF NOT EXISTS "timezone"           TEXT;

-- Step 3: Backfill new columns from preferences JSON (for existing users)
UPDATE "users"
SET
  "internal_sub_role" = COALESCE(
    "preferences"->>'internalSubRole',
    "preferences"->>'internal_sub_role'
  ),
  "department" = COALESCE(
    "preferences"->>'department'
  ),
  "job_title" = COALESCE(
    "preferences"->>'jobTitle',
    "preferences"->>'job_title'
  ),
  "phone" = COALESCE(
    "preferences"->>'phone'
  ),
  "timezone" = COALESCE(
    "preferences"->>'timezone'
  )
WHERE
  "preferences" IS NOT NULL
  AND "preferences"::text != '{}';

-- Step 4: Add per-tenant unique constraint on (tenant_id, email)
ALTER TABLE "users"
  ADD CONSTRAINT "users_tenant_id_email_key" UNIQUE ("tenant_id", "email");

-- Step 5: Create ProjectRole enum
DO $$ BEGIN
  CREATE TYPE "ProjectRole" AS ENUM ('VIEWER', 'MEMBER', 'LEAD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 6: Create user_projects junction table
CREATE TABLE IF NOT EXISTS "user_projects" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID        NOT NULL,
  "project_id" UUID        NOT NULL,
  "role"       "ProjectRole" NOT NULL DEFAULT 'MEMBER',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT "user_projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_projects_user_id_fkey"    FOREIGN KEY ("user_id")    REFERENCES "users"("id")    ON DELETE CASCADE,
  CONSTRAINT "user_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "user_projects_user_id_project_id_key" UNIQUE ("user_id", "project_id")
);

-- Step 7: Add indexes on user_projects
CREATE INDEX IF NOT EXISTS "user_projects_project_id_idx" ON "user_projects"("project_id");
CREATE INDEX IF NOT EXISTS "user_projects_user_id_idx"    ON "user_projects"("user_id");
