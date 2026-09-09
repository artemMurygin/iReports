-- CreateTable
CREATE TABLE "goods_turnover_report_lines" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "category_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "outcome_quantity" INTEGER NOT NULL,
    "outcome_sum" INTEGER NOT NULL,
    "stock_quantity" INTEGER NOT NULL,
    "stock_sum" INTEGER NOT NULL,
    "turnover_ratio" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_turnover_report_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roapp_warehouses" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "roapp_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "goods_turnover_report_lines_period_category_id_warehouse_id_key" ON "goods_turnover_report_lines"("period", "category_id", "warehouse_id");

