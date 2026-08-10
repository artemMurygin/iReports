-- CreateEnum
CREATE TYPE "sales_direction" AS ENUM ('service', 'shop');

-- CreateEnum
CREATE TYPE "sales_plan_source" AS ENUM ('PREVIOUS_MONTH', 'TEMPLATE', 'MANUAL');

-- CreateEnum
CREATE TYPE "sales_plan_status" AS ENUM ('CREATED', 'APPROVED');

-- CreateTable
CREATE TABLE "sales_plan_templates" (
    "id" TEXT NOT NULL,
    "direction" "sales_direction" NOT NULL,
    "department_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "turnover" INTEGER NOT NULL,
    "margin" INTEGER NOT NULL,
    "growth_percent" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_plan_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_plans" (
    "id" TEXT NOT NULL,
    "direction" "sales_direction" NOT NULL,
    "department_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "turnover" INTEGER NOT NULL,
    "margin" INTEGER NOT NULL,
    "source" "sales_plan_source" NOT NULL,
    "status" "sales_plan_status" NOT NULL DEFAULT 'CREATED',
    "approved_by" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_plan_templates_direction_department_id_category_id_key" ON "sales_plan_templates"("direction", "department_id", "category_id");

-- CreateIndex
CREATE INDEX "sales_plans_direction_period_idx" ON "sales_plans"("direction", "period");

-- CreateIndex
CREATE UNIQUE INDEX "sales_plans_direction_department_id_category_id_period_key" ON "sales_plans"("direction", "department_id", "category_id", "period");

-- AddForeignKey
ALTER TABLE "sales_plan_templates" ADD CONSTRAINT "sales_plan_templates_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "bitrix_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_plans" ADD CONSTRAINT "sales_plans_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "bitrix_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
