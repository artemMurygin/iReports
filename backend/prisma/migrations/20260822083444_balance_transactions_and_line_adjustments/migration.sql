-- CreateEnum
CREATE TYPE "balance_transaction_type" AS ENUM ('SALARY_ACCRUAL', 'ACCRUAL_ADJUSTMENT', 'ADVANCE', 'EXTRA_ADVANCE', 'BONUS', 'SICK_LEAVE', 'VACATION_PAY', 'PENALTY', 'ADJUSTMENT', 'MANUAL_REVERSAL', 'PAYOUT');

-- DropIndex
DROP INDEX "moy_sklad_product_folders_path_name_idx";

-- CreateTable
CREATE TABLE "balance_transactions" (
    "id" TEXT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "direction" "sales_direction" NOT NULL,
    "type" "balance_transaction_type" NOT NULL,
    "amount" INTEGER NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER NOT NULL,
    "comment" TEXT,
    "period" TEXT,
    "accrual_id" TEXT,
    "line_id" TEXT,
    "rule_id" TEXT,
    "reversed_transaction_id" TEXT,
    "erp_sync_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_accrual_line_adjustments" (
    "id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "previous_amount" INTEGER NOT NULL,
    "new_amount" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "adjusted_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_accrual_line_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "balance_transactions_employee_id_direction_occurred_at_idx" ON "balance_transactions"("employee_id", "direction", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "balance_transactions_line_id_type_key" ON "balance_transactions"("line_id", "type");

-- CreateIndex
CREATE INDEX "salary_accrual_line_adjustments_line_id_idx" ON "salary_accrual_line_adjustments"("line_id");

-- CreateIndex
CREATE INDEX "moy_sklad_product_folders_path_name_idx" ON "moy_sklad_product_folders"("path_name" text_pattern_ops);

-- AddForeignKey
ALTER TABLE "salary_accrual_line_adjustments" ADD CONSTRAINT "salary_accrual_line_adjustments_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "salary_accrual_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
