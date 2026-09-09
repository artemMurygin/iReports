-- DropIndex
DROP INDEX "moy_sklad_product_folders_path_name_idx";

-- AlterTable
ALTER TABLE "salary_accrual_lines" ADD COLUMN     "comment" TEXT,
ADD COLUMN     "requires_manual_input" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "salary_tasks" (
    "id" TEXT NOT NULL,
    "salary_rule_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "is_recurring" BOOLEAN NOT NULL,
    "bitrix_task_id" TEXT NOT NULL,
    "task_status" TEXT NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salary_tasks_salary_rule_id_period_key" ON "salary_tasks"("salary_rule_id", "period");

-- CreateIndex
CREATE INDEX "moy_sklad_product_folders_path_name_idx" ON "moy_sklad_product_folders"("path_name" text_pattern_ops);
