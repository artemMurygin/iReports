-- CreateEnum
CREATE TYPE "salary_accrual_status" AS ENUM ('DRAFT', 'PARTIALLY_ACCRUED', 'ACCRUED', 'PAID');

-- CreateEnum
CREATE TYPE "salary_accrual_line_status" AS ENUM ('DRAFT', 'ACCRUED', 'PAID');

-- DropIndex
DROP INDEX "moy_sklad_product_folders_path_name_idx";

-- AlterTable
ALTER TABLE "bitrix_employees" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "salary_accruals" (
    "id" TEXT NOT NULL,
    "direction" "sales_direction" NOT NULL,
    "period" TEXT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "status" "salary_accrual_status" NOT NULL DEFAULT 'DRAFT',
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "total" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_accruals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_accrual_lines" (
    "id" TEXT NOT NULL,
    "accrual_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rule_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_role" TEXT NOT NULL,
    "salary_basis" TEXT,
    "quantity" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION,
    "original_amount" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "sources" JSONB NOT NULL,
    "status" "salary_accrual_line_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_accrual_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_accruals_direction_period_idx" ON "salary_accruals"("direction", "period");

-- CreateIndex
CREATE UNIQUE INDEX "salary_accruals_direction_period_employee_id_key" ON "salary_accruals"("direction", "period", "employee_id");

-- CreateIndex
CREATE INDEX "salary_accrual_lines_accrual_id_idx" ON "salary_accrual_lines"("accrual_id");

-- CreateIndex
CREATE INDEX "moy_sklad_product_folders_path_name_idx" ON "moy_sklad_product_folders"("path_name" text_pattern_ops);

-- AddForeignKey
ALTER TABLE "salary_accrual_lines" ADD CONSTRAINT "salary_accrual_lines_accrual_id_fkey" FOREIGN KEY ("accrual_id") REFERENCES "salary_accruals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
