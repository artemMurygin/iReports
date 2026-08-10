-- Drops the entire salary module (salary.prisma removed — module will be redesigned)

-- DropForeignKey
ALTER TABLE "salary_goals" DROP CONSTRAINT "salary_goals_rewardId_fkey";

-- DropForeignKey
ALTER TABLE "salary_goals" DROP CONSTRAINT "salary_goals_rule_id_fkey";

-- DropForeignKey
ALTER TABLE "salary_line_items" DROP CONSTRAINT "salary_line_items_report_id_fkey";

-- DropForeignKey
ALTER TABLE "salary_reward_progression_tiers" DROP CONSTRAINT "salary_reward_progression_tiers_reward_id_fkey";

-- DropForeignKey
ALTER TABLE "salary_rule_assignments" DROP CONSTRAINT "salary_rule_assignments_rule_id_fkey";

-- DropForeignKey
ALTER TABLE "salary_task_completions" DROP CONSTRAINT "salary_task_completions_goal_id_fkey";

-- DropTable
DROP TABLE "salary_adjustments";

-- DropTable
DROP TABLE "salary_goals";

-- DropTable
DROP TABLE "salary_line_items";

-- DropTable
DROP TABLE "salary_plan_targets";

-- DropTable
DROP TABLE "salary_reports";

-- DropTable
DROP TABLE "salary_reward_progression_tiers";

-- DropTable
DROP TABLE "salary_rewards";

-- DropTable
DROP TABLE "salary_rule_assignments";

-- DropTable
DROP TABLE "salary_rules";

-- DropTable
DROP TABLE "salary_task_completions";

-- DropTable
DROP TABLE "salary_turnover_snapshots";

-- DropTable
DROP TABLE "salary_work_shifts";

-- DropEnum
DROP TYPE "salary_accrual_type";

-- DropEnum
DROP TYPE "salary_direction";

-- DropEnum
DROP TYPE "salary_goal_type";

-- DropEnum
DROP TYPE "salary_kpi_direction";

-- DropEnum
DROP TYPE "salary_kpi_stat";

-- DropEnum
DROP TYPE "salary_manager_role";

-- DropEnum
DROP TYPE "salary_progression_mode";

-- DropEnum
DROP TYPE "salary_report_status";

-- DropEnum
DROP TYPE "salary_reward_type";

-- DropEnum
DROP TYPE "salary_rule_status";

-- DropEnum
DROP TYPE "salary_scope";
