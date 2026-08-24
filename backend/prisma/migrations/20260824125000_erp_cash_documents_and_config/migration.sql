-- CreateEnum
CREATE TYPE "erp_cash_document_kind" AS ENUM ('INCOME', 'EXPENSE');

-- DropIndex
DROP INDEX "moy_sklad_product_folders_path_name_idx";

-- CreateTable
CREATE TABLE "erp_cash_documents" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "system" "external_system" NOT NULL,
    "kind" "erp_cash_document_kind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_cash_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_cash_configs" (
    "id" TEXT NOT NULL,
    "direction" "sales_direction" NOT NULL,
    "roapp_cashbox_id" INTEGER,
    "moy_sklad_expense_item_id" TEXT,
    "moy_sklad_income_item_id" TEXT,
    "organization_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_cash_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "erp_cash_documents_transaction_id_key" ON "erp_cash_documents"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "erp_cash_configs_direction_key" ON "erp_cash_configs"("direction");

-- CreateIndex
CREATE INDEX "moy_sklad_product_folders_path_name_idx" ON "moy_sklad_product_folders"("path_name" text_pattern_ops);
