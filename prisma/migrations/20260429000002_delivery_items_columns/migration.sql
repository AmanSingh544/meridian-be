-- Add missing columns to delivery_items that were in the schema but not the original migration
ALTER TABLE delivery_items
  ADD COLUMN IF NOT EXISTS category  TEXT,
  ADD COLUMN IF NOT EXISTS quarter   TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;
