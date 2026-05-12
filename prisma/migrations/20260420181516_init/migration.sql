/*
  Warnings:

  - The `category` column on the `tickets` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[ticket_number]` on the table `tickets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updated_at` to the `comments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('INCIDENT', 'BUG', 'FEATURE_REQUEST', 'QUESTION', 'SUPPORT', 'BILLING', 'TASK');

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'ACKNOWLEDGED';

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "mentions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "ticket_number" DROP DEFAULT,
ALTER COLUMN "ticket_number" SET DATA TYPE TEXT,
DROP COLUMN "category",
ADD COLUMN     "category" "TicketCategory";
DROP SEQUENCE "tickets_ticket_number_seq";

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "tickets_tenant_id_category_idx" ON "tickets"("tenant_id", "category");
