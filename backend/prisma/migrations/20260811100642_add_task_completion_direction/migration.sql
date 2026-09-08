-- DropIndex
DROP INDEX "moy_sklad_product_folders_path_name_idx";

-- AlterTable
ALTER TABLE "task_completions" ADD COLUMN     "direction" TEXT NOT NULL DEFAULT 'service';

-- CreateIndex
CREATE INDEX "moy_sklad_product_folders_path_name_idx" ON "moy_sklad_product_folders"("path_name" text_pattern_ops);
