-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "employee_identity_type" ADD VALUE 'MOY_SKLAD_ONLINE_PURCHASER_FIELD';
ALTER TYPE "employee_identity_type" ADD VALUE 'MOY_SKLAD_OFFLINE_PURCHASER_FIELD';

-- AlterTable
ALTER TABLE "moy_sklad_demand_positions" ADD COLUMN     "offline_purchaser_id" TEXT,
ADD COLUMN     "online_purchaser_id" TEXT;

-- CreateIndex
CREATE INDEX "moy_sklad_demand_positions_online_purchaser_id_idx" ON "moy_sklad_demand_positions"("online_purchaser_id");

-- CreateIndex
CREATE INDEX "moy_sklad_demand_positions_offline_purchaser_id_idx" ON "moy_sklad_demand_positions"("offline_purchaser_id");

-- CreateIndex
CREATE INDEX "moy_sklad_product_folders_path_name_idx" ON "moy_sklad_product_folders"("path_name" text_pattern_ops);
