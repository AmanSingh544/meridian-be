-- Add project_id to tickets table with FK to projects
ALTER TABLE "tickets" ADD COLUMN "project_id" UUID;

ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_project_id_fkey"
  FOREIGN KEY ("project_id")
  REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tickets_tenant_id_project_id_idx" ON "tickets"("tenant_id", "project_id");
