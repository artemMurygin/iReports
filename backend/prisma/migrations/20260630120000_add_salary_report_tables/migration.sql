-- CreateEnum
CREATE TYPE "salary_report_metric_type" AS ENUM ('revenue', 'margin');

-- CreateEnum
CREATE TYPE "salary_report_payout_base" AS ENUM ('revenue', 'margin');

-- CreateEnum
CREATE TYPE "salary_report_fact_source" AS ENUM ('moy_sklad', 'roapp', 'manual');

-- CreateTable: bitrix_departments
CREATE TABLE "bitrix_departments" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "bitrix_departments_pkey" PRIMARY KEY ("id")
);

-- Populate departments with placeholder names from existing employee data.
-- Names will be updated when Bitrix department sync runs.
INSERT INTO "bitrix_departments" ("id", "name")
SELECT DISTINCT "department", 'Отдел #' || "department"::text
FROM "bitrix_employees"
WHERE "department" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

-- AlterTable: bitrix_employees — add cross-system links and FK to departments
ALTER TABLE "bitrix_employees"
    ADD COLUMN "moy_sklad_id" TEXT,
    ADD COLUMN "roapp_id" INTEGER;

-- CreateIndex: unique cross-system IDs
CREATE UNIQUE INDEX "bitrix_employees_roapp_id_key" ON "bitrix_employees"("roapp_id");
CREATE UNIQUE INDEX "bitrix_employees_moy_sklad_id_key" ON "bitrix_employees"("moy_sklad_id");

-- AddForeignKey: bitrix_employees.department → bitrix_departments
ALTER TABLE "bitrix_employees" ADD CONSTRAINT "bitrix_employees_department_fkey"
    FOREIGN KEY ("department") REFERENCES "bitrix_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: bitrix_employees.roapp_id → roapp_employees
ALTER TABLE "bitrix_employees" ADD CONSTRAINT "bitrix_employees_roapp_id_fkey"
    FOREIGN KEY ("roapp_id") REFERENCES "roapp_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: bitrix_employees.moy_sklad_id → moy_sklad_employees
ALTER TABLE "bitrix_employees" ADD CONSTRAINT "bitrix_employees_moy_sklad_id_fkey"
    FOREIGN KEY ("moy_sklad_id") REFERENCES "moy_sklad_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Таблицы системы мотивации
-- ─────────────────────────────────────────────────────────────────────────

-- CreateTable: salary_report_directions
CREATE TABLE "salary_report_directions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "salary_report_directions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "salary_report_directions_name_key" ON "salary_report_directions"("name");

-- CreateTable: salary_report_targets
CREATE TABLE "salary_report_targets" (
    "id" SERIAL NOT NULL,
    "direction_id" INTEGER NOT NULL,
    "metric" "salary_report_metric_type" NOT NULL DEFAULT 'revenue',
    "moy_sklad_folder_id" TEXT,
    "roapp_service_category_id" INTEGER,
    "roapp_product_category_id" INTEGER,

    CONSTRAINT "salary_report_targets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "salary_report_targets_direction_id_moy_sklad_folder_id_roap_key"
    ON "salary_report_targets"("direction_id", "moy_sklad_folder_id", "roapp_service_category_id", "roapp_product_category_id", "metric");

-- Partial unique index: уникальность «всё направление» (все FK = null)
CREATE UNIQUE INDEX "salary_report_targets_whole_direction_key"
    ON "salary_report_targets"("direction_id", "metric")
    WHERE "moy_sklad_folder_id" IS NULL
      AND "roapp_service_category_id" IS NULL
      AND "roapp_product_category_id" IS NULL;

-- CreateTable: salary_report_coefficient_scales
CREATE TABLE "salary_report_coefficient_scales" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "salary_report_coefficient_scales_pkey" PRIMARY KEY ("id")
);

-- CreateTable: salary_report_coefficient_points
CREATE TABLE "salary_report_coefficient_points" (
    "id" SERIAL NOT NULL,
    "scale_id" INTEGER NOT NULL,
    "fulfillment_pct" DECIMAL(6,4) NOT NULL,
    "coefficient" DECIMAL(6,4) NOT NULL,

    CONSTRAINT "salary_report_coefficient_points_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "salary_report_coefficient_points_scale_id_fulfillment_pct_key"
    ON "salary_report_coefficient_points"("scale_id", "fulfillment_pct");

-- CreateTable: salary_report_motivation_rules
CREATE TABLE "salary_report_motivation_rules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "direction_id" INTEGER NOT NULL,
    "scale_id" INTEGER NOT NULL,
    "payout_base" "salary_report_payout_base" NOT NULL DEFAULT 'margin',
    "effective_from" DATE,

    CONSTRAINT "salary_report_motivation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: salary_report_rule_items
CREATE TABLE "salary_report_rule_items" (
    "id" SERIAL NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "target_id" INTEGER NOT NULL,
    "base_percent" DECIMAL(6,4) NOT NULL,

    CONSTRAINT "salary_report_rule_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "salary_report_rule_items_rule_id_target_id_key"
    ON "salary_report_rule_items"("rule_id", "target_id");

-- CreateTable: salary_report_plans
CREATE TABLE "salary_report_plans" (
    "id" SERIAL NOT NULL,
    "target_id" INTEGER NOT NULL,
    "period" DATE NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "salary_report_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "salary_report_plans_target_id_period_key"
    ON "salary_report_plans"("target_id", "period");
ALTER TABLE "salary_report_plans" ADD CONSTRAINT "chk_plan_period_first_day"
    CHECK (EXTRACT(DAY FROM "period") = 1);

-- CreateTable: salary_report_facts
CREATE TABLE "salary_report_facts" (
    "id" SERIAL NOT NULL,
    "target_id" INTEGER NOT NULL,
    "period" DATE NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "source" "salary_report_fact_source" NOT NULL DEFAULT 'manual',
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "salary_report_facts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "salary_report_facts_target_id_period_key"
    ON "salary_report_facts"("target_id", "period");
ALTER TABLE "salary_report_facts" ADD CONSTRAINT "chk_fact_period_first_day"
    CHECK (EXTRACT(DAY FROM "period") = 1);

-- CreateTable: salary_report_employee_rules
CREATE TABLE "salary_report_employee_rules" (
    "id" SERIAL NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "bitrix_employee_id" INTEGER,
    "bitrix_department_id" INTEGER,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,

    CONSTRAINT "salary_report_employee_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_employee_rule_single_ref" CHECK (
        (CASE WHEN "bitrix_employee_id"   IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN "bitrix_department_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);

-- CreateTable: salary_report_results
CREATE TABLE "salary_report_results" (
    "id" SERIAL NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "bitrix_employee_id" INTEGER NOT NULL,
    "period" DATE NOT NULL,
    "computed_salary" DECIMAL(14,2) NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_report_results_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "salary_report_results_bitrix_employee_id_period_key"
    ON "salary_report_results"("bitrix_employee_id", "period");

-- ─────────────────────────────────────────────────────────────────────────
-- Foreign Keys
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "salary_report_targets"
    ADD CONSTRAINT "salary_report_targets_direction_id_fkey"
        FOREIGN KEY ("direction_id") REFERENCES "salary_report_directions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "salary_report_targets_moy_sklad_folder_id_fkey"
        FOREIGN KEY ("moy_sklad_folder_id") REFERENCES "moy_sklad_product_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "salary_report_targets_roapp_service_category_id_fkey"
        FOREIGN KEY ("roapp_service_category_id") REFERENCES "roapp_service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "salary_report_targets_roapp_product_category_id_fkey"
        FOREIGN KEY ("roapp_product_category_id") REFERENCES "roapp_product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "salary_report_coefficient_points"
    ADD CONSTRAINT "salary_report_coefficient_points_scale_id_fkey"
        FOREIGN KEY ("scale_id") REFERENCES "salary_report_coefficient_scales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "salary_report_motivation_rules"
    ADD CONSTRAINT "salary_report_motivation_rules_direction_id_fkey"
        FOREIGN KEY ("direction_id") REFERENCES "salary_report_directions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "salary_report_motivation_rules_scale_id_fkey"
        FOREIGN KEY ("scale_id") REFERENCES "salary_report_coefficient_scales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "salary_report_rule_items"
    ADD CONSTRAINT "salary_report_rule_items_rule_id_fkey"
        FOREIGN KEY ("rule_id") REFERENCES "salary_report_motivation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "salary_report_rule_items_target_id_fkey"
        FOREIGN KEY ("target_id") REFERENCES "salary_report_targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "salary_report_plans"
    ADD CONSTRAINT "salary_report_plans_target_id_fkey"
        FOREIGN KEY ("target_id") REFERENCES "salary_report_targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "salary_report_facts"
    ADD CONSTRAINT "salary_report_facts_target_id_fkey"
        FOREIGN KEY ("target_id") REFERENCES "salary_report_targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "salary_report_employee_rules"
    ADD CONSTRAINT "salary_report_employee_rules_rule_id_fkey"
        FOREIGN KEY ("rule_id") REFERENCES "salary_report_motivation_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "salary_report_employee_rules_bitrix_employee_id_fkey"
        FOREIGN KEY ("bitrix_employee_id") REFERENCES "bitrix_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "salary_report_employee_rules_bitrix_department_id_fkey"
        FOREIGN KEY ("bitrix_department_id") REFERENCES "bitrix_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "salary_report_results"
    ADD CONSTRAINT "salary_report_results_rule_id_fkey"
        FOREIGN KEY ("rule_id") REFERENCES "salary_report_motivation_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "salary_report_results_bitrix_employee_id_fkey"
        FOREIGN KEY ("bitrix_employee_id") REFERENCES "bitrix_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
