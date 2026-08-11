-- CreateEnum
CREATE TYPE "accounting_period_status" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" TEXT NOT NULL,
    "direction" "sales_direction" NOT NULL,
    "period" TEXT NOT NULL,
    "status" "accounting_period_status" NOT NULL DEFAULT 'OPEN',
    "closed_by" INTEGER,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_calculation_cache" (
    "id" TEXT NOT NULL,
    "direction" "sales_direction" NOT NULL,
    "period" TEXT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "freshness_stamp" TEXT NOT NULL,
    "fact_total" INTEGER NOT NULL,
    "prognose_total" INTEGER NOT NULL,
    "fact_lines" JSONB NOT NULL,
    "prognose_lines" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_calculation_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_period_snapshots" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "direction" "sales_direction" NOT NULL,
    "period" TEXT NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "lines" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_period_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_sync_status" (
    "direction" "sales_direction" NOT NULL,
    "last_successful_sync_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_sync_status_pkey" PRIMARY KEY ("direction")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_periods_direction_period_key" ON "accounting_periods"("direction", "period");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_calculation_cache_direction_period_employee_id_key" ON "accounting_calculation_cache"("direction", "period", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_period_snapshots_direction_period_employee_id_key" ON "accounting_period_snapshots"("direction", "period", "employee_id");

-- AddForeignKey
ALTER TABLE "accounting_period_snapshots" ADD CONSTRAINT "accounting_period_snapshots_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "accounting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
