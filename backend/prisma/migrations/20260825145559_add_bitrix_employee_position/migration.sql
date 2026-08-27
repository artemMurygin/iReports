-- DropIndex
DROP INDEX "moy_sklad_product_folders_path_name_idx";

-- AlterTable
ALTER TABLE "bitrix_employees" ADD COLUMN     "position" TEXT;

-- CreateIndex
CREATE INDEX "moy_sklad_product_folders_path_name_idx" ON "moy_sklad_product_folders"("path_name" text_pattern_ops);
