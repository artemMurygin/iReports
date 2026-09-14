/*
  Warnings:

  - You are about to drop the column `offline_purchaser_id` on the `moy_sklad_demand_positions` table. All the data in the column will be lost.
  - You are about to drop the column `online_purchaser_id` on the `moy_sklad_demand_positions` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "moy_sklad_demand_positions_offline_purchaser_id_idx";

-- DropIndex
DROP INDEX "moy_sklad_demand_positions_online_purchaser_id_idx";

-- DropIndex
DROP INDEX "moy_sklad_product_folders_path_name_idx";

-- AlterTable
ALTER TABLE "moy_sklad_demand_positions" DROP COLUMN "offline_purchaser_id",
DROP COLUMN "online_purchaser_id";

-- AlterTable
ALTER TABLE "moy_sklad_products" ADD COLUMN     "offline_purchaser_id" TEXT,
ADD COLUMN     "online_purchaser_id" TEXT;

-- CreateIndex
CREATE INDEX "moy_sklad_product_folders_path_name_idx" ON "moy_sklad_product_folders"("path_name" text_pattern_ops);

-- CreateIndex
CREATE INDEX "moy_sklad_products_online_purchaser_id_idx" ON "moy_sklad_products"("online_purchaser_id");

-- CreateIndex
CREATE INDEX "moy_sklad_products_offline_purchaser_id_idx" ON "moy_sklad_products"("offline_purchaser_id");
