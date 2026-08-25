/*
  Warnings:

  - You are about to drop the `erp_cash_configs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "moy_sklad_product_folders_path_name_idx";

-- DropTable
DROP TABLE "erp_cash_configs";

-- CreateIndex
CREATE INDEX "moy_sklad_product_folders_path_name_idx" ON "moy_sklad_product_folders"("path_name" text_pattern_ops);
