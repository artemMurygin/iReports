-- CreateEnum
CREATE TYPE "salary_manager_role" AS ENUM ('OFFLINE', 'ONLINE', 'BOTH');

-- AlterTable
ALTER TABLE "salary_goals" ADD COLUMN "manager_role" "salary_manager_role" NOT NULL DEFAULT 'OFFLINE';

-- AlterTable
ALTER TABLE "bitrix_employees" ADD COLUMN "roapp_online_name" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "bitrix_employees_roapp_online_name_key" ON "bitrix_employees"("roapp_online_name");