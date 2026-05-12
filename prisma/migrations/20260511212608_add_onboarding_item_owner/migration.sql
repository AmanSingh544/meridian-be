-- DropForeignKey
ALTER TABLE "user_projects" DROP CONSTRAINT "user_projects_project_id_fkey";

-- DropForeignKey
ALTER TABLE "user_projects" DROP CONSTRAINT "user_projects_user_id_fkey";

-- DropIndex
DROP INDEX "users_email_key";

-- AlterTable
ALTER TABLE "onboarding_items" ADD COLUMN     "owner" TEXT NOT NULL DEFAULT 'DELIVERY';

-- AlterTable
ALTER TABLE "user_projects" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "user_projects" ADD CONSTRAINT "user_projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_projects" ADD CONSTRAINT "user_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
