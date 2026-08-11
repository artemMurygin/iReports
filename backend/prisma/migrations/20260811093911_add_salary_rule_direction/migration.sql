-- DropIndex
DROP INDEX "moy_sklad_product_folders_path_name_idx";

-- AlterTable
ALTER TABLE "salary_rules" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT 'service';

-- CreateIndex
CREATE INDEX "moy_sklad_product_folders_path_name_idx" ON "moy_sklad_product_folders"("path_name" text_pattern_ops);

-- CreateIndex
CREATE INDEX "salary_rules_motivation_schema_id_direction_idx" ON "salary_rules"("motivation_schema_id", "direction");
