-- CreateEnum
CREATE TYPE "salary_direction" AS ENUM ('SERVICE', 'SHOP');

-- CreateEnum
CREATE TYPE "salary_goal_type" AS ENUM ('KPI', 'TASK');

-- CreateEnum
CREATE TYPE "salary_kpi_direction" AS ENUM ('SALES', 'TURNOVER');

-- CreateEnum
CREATE TYPE "salary_kpi_stat" AS ENUM ('REVENUE', 'MARGIN', 'MARGIN_MINUS_ENGINEER', 'PCS', 'COSTS');

-- CreateEnum
CREATE TYPE "salary_scope" AS ENUM ('PERSONAL', 'DEPARTMENT', 'COMPANY');

-- CreateEnum
CREATE TYPE "salary_reward_type" AS ENUM ('PERCENT', 'FIX');

-- CreateEnum
CREATE TYPE "salary_progression_mode" AS ENUM ('FIXED', 'LINEAR', 'MULTIPLIER');

-- CreateEnum
CREATE TYPE "salary_accrual_type" AS ENUM ('HOURLY', 'BONUS', 'PENALTY', 'ADJUSTMENT', 'FIXED', 'ADVANCE');

-- CreateEnum
CREATE TYPE "salary_rule_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "salary_report_status" AS ENUM ('PROJECTED', 'CLOSED');

-- CreateTable
CREATE TABLE "salary_rules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "pay_per_hour" INTEGER,
    "is_regular" BOOLEAN NOT NULL DEFAULT false,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3),
    "status" "salary_rule_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_rule_assignments" (
    "id" SERIAL NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "employee_id" INTEGER,
    "department_id" INTEGER,

    CONSTRAINT "salary_rule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_goals" (
    "id" SERIAL NOT NULL,
    "rule_id" INTEGER NOT NULL,
    "type" "salary_goal_type" NOT NULL,
    "direction" "salary_direction" NOT NULL,
    "scope" "salary_scope" NOT NULL DEFAULT 'PERSONAL',
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "kpi_direction" "salary_kpi_direction",
    "measure_stat" "salary_kpi_stat",
    "category_ext_id" TEXT,
    "rewardId" INTEGER NOT NULL,

    CONSTRAINT "salary_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_rewards" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "salary_reward_type" NOT NULL,
    "value" INTEGER NOT NULL,
    "base_stat" "salary_kpi_stat",
    "category_ext_id" TEXT,
    "min_amount" INTEGER,
    "max_amount" INTEGER,

    CONSTRAINT "salary_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_reward_progression_tiers" (
    "id" SERIAL NOT NULL,
    "reward_id" INTEGER NOT NULL,
    "from_pct" INTEGER NOT NULL,
    "to_pct" INTEGER,
    "mode" "salary_progression_mode" NOT NULL,
    "coef" DOUBLE PRECISION,
    "coef_from" DOUBLE PRECISION,
    "coef_to" DOUBLE PRECISION,

    CONSTRAINT "salary_reward_progression_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_plan_targets" (
    "id" SERIAL NOT NULL,
    "period" TEXT NOT NULL,
    "direction" "salary_direction" NOT NULL,
    "scope" "salary_scope" NOT NULL,
    "employee_id" INTEGER,
    "department_id" INTEGER,
    "category_ext_id" TEXT,
    "stat" "salary_kpi_stat" NOT NULL,
    "plan_value" INTEGER NOT NULL,

    CONSTRAINT "salary_plan_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_work_shifts" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "planned_start" TIMESTAMP(3),
    "planned_end" TIMESTAMP(3),
    "planned_hours" DOUBLE PRECISION NOT NULL,
    "actual_hours" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "note" TEXT,

    CONSTRAINT "salary_work_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_task_completions" (
    "id" SERIAL NOT NULL,
    "goal_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "approved_by_id" INTEGER,

    CONSTRAINT "salary_task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_reports" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "status" "salary_report_status" NOT NULL DEFAULT 'PROJECTED',
    "fact_total" INTEGER NOT NULL,
    "projected" INTEGER NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "salary_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_line_items" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "accrual_type" "salary_accrual_type" NOT NULL,
    "goal_id" INTEGER,
    "reward_id" INTEGER,
    "source_type" TEXT,
    "source_id" TEXT,
    "label" TEXT NOT NULL,
    "fact_amount" INTEGER NOT NULL,
    "projected" INTEGER NOT NULL,
    "meta" JSONB,

    CONSTRAINT "salary_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_adjustments" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "accrual_type" "salary_accrual_type" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_turnover_snapshots" (
    "id" SERIAL NOT NULL,
    "period" TEXT NOT NULL,
    "category_ext_id" TEXT,
    "product_id" TEXT,
    "avg_stock_cost" INTEGER NOT NULL,
    "cogs" INTEGER NOT NULL,
    "turnover_days" DOUBLE PRECISION,

    CONSTRAINT "salary_turnover_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_rules_status_valid_from_valid_to_idx" ON "salary_rules"("status", "valid_from", "valid_to");

-- CreateIndex
CREATE INDEX "salary_rule_assignments_rule_id_idx" ON "salary_rule_assignments"("rule_id");

-- CreateIndex
CREATE INDEX "salary_rule_assignments_employee_id_idx" ON "salary_rule_assignments"("employee_id");

-- CreateIndex
CREATE INDEX "salary_rule_assignments_department_id_idx" ON "salary_rule_assignments"("department_id");

-- CreateIndex
CREATE INDEX "salary_goals_rule_id_idx" ON "salary_goals"("rule_id");

-- CreateIndex
CREATE INDEX "salary_goals_rewardId_idx" ON "salary_goals"("rewardId");

-- CreateIndex
CREATE INDEX "salary_reward_progression_tiers_reward_id_idx" ON "salary_reward_progression_tiers"("reward_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_plan_targets_period_direction_scope_employee_id_depa_key" ON "salary_plan_targets"("period", "direction", "scope", "employee_id", "department_id", "category_ext_id", "stat");

-- CreateIndex
CREATE INDEX "salary_work_shifts_employee_id_date_idx" ON "salary_work_shifts"("employee_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "salary_work_shifts_employee_id_date_key" ON "salary_work_shifts"("employee_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "salary_task_completions_goal_id_employee_id_period_key" ON "salary_task_completions"("goal_id", "employee_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "salary_reports_employee_id_period_key" ON "salary_reports"("employee_id", "period");

-- CreateIndex
CREATE INDEX "salary_line_items_report_id_idx" ON "salary_line_items"("report_id");

-- CreateIndex
CREATE INDEX "salary_adjustments_employee_id_period_idx" ON "salary_adjustments"("employee_id", "period");

-- CreateIndex
CREATE INDEX "salary_turnover_snapshots_period_idx" ON "salary_turnover_snapshots"("period");

-- AddForeignKey
ALTER TABLE "salary_rule_assignments" ADD CONSTRAINT "salary_rule_assignments_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "salary_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_goals" ADD CONSTRAINT "salary_goals_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "salary_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_goals" ADD CONSTRAINT "salary_goals_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "salary_rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_reward_progression_tiers" ADD CONSTRAINT "salary_reward_progression_tiers_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "salary_rewards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_task_completions" ADD CONSTRAINT "salary_task_completions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "salary_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_line_items" ADD CONSTRAINT "salary_line_items_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "salary_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
