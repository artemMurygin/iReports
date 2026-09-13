-- DropIndex
DROP INDEX "moy_sklad_product_folders_path_name_idx";

-- AlterTable
ALTER TABLE "salary_rules" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "moy_sklad_product_folders_path_name_idx" ON "moy_sklad_product_folders"("path_name" text_pattern_ops);
