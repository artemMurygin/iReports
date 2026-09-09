-- AlterTable
ALTER TABLE "moy_sklad_demands" ADD COLUMN     "store_id" TEXT;

-- CreateTable
CREATE TABLE "moy_sklad_turnover_report_lines" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "turnover_quantity" DOUBLE PRECISION NOT NULL,
    "turnover_sum" INTEGER NOT NULL,
    "stock_quantity" DOUBLE PRECISION NOT NULL,
    "stock_sum" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moy_sklad_turnover_report_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moy_sklad_stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "moy_sklad_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moy_sklad_stocks" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "cost_sum" INTEGER NOT NULL,
    "snapshot_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moy_sklad_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "moy_sklad_turnover_report_lines_period_category_id_warehous_key" ON "moy_sklad_turnover_report_lines"("period", "category_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "moy_sklad_stocks_snapshot_at_idx" ON "moy_sklad_stocks"("snapshot_at");

-- CreateIndex
CREATE UNIQUE INDEX "moy_sklad_stocks_product_id_warehouse_id_snapshot_at_key" ON "moy_sklad_stocks"("product_id", "warehouse_id", "snapshot_at");

-- CreateIndex
CREATE INDEX "moy_sklad_demands_store_id_idx" ON "moy_sklad_demands"("store_id");

-- AddForeignKey
ALTER TABLE "moy_sklad_demands" ADD CONSTRAINT "moy_sklad_demands_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "moy_sklad_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

