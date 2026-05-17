-- AlterTable
ALTER TABLE "delivery_items" ADD COLUMN     "upvotes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "routing_rules" ADD COLUMN     "description" TEXT;
