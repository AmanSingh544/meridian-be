-- Add nullable foreign key column linking roadmap features to their source delivery items
ALTER TABLE "roadmap_features" ADD COLUMN "delivery_item_id" UUID;

-- Link existing roadmap features to matching delivery items by title within the same tenant.
-- DISTINCT ON (di.id) ensures each delivery item links to at most one roadmap feature.
WITH matched AS (
  SELECT DISTINCT ON (di.id)
    rf.id AS roadmap_feature_id,
    di.id AS delivery_item_id
  FROM "roadmap_features" rf
  JOIN "delivery_items" di
    ON rf.tenant_id = di.tenant_id
    AND LOWER(TRIM(rf.title)) = LOWER(TRIM(di.title))
  WHERE rf.delivery_item_id IS NULL
  ORDER BY di.id, rf.created_at ASC
)
UPDATE "roadmap_features" rf
SET delivery_item_id = m.delivery_item_id
FROM matched m
WHERE rf.id = m.roadmap_feature_id;

-- Enforce one roadmap feature per delivery item
CREATE UNIQUE INDEX "roadmap_features_delivery_item_id_key" ON "roadmap_features"("delivery_item_id");

-- Add foreign key constraint with cascade delete
ALTER TABLE "roadmap_features" ADD CONSTRAINT "roadmap_features_delivery_item_id_fkey"
  FOREIGN KEY ("delivery_item_id") REFERENCES "delivery_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
