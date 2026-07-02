import { Module } from '@nestjs/common';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { DirectoryController } from './directory/directory.controller';
import { SalaryReportController } from './report/salary-report.controller';
import { SalaryCalculationService } from './calculation/salary-calculation.service';
import { SalaryRulesController } from './rules/salary-rules.controller';
import { SalaryRulesService } from './rules/salary-rules.service';
import { GoalsController } from './goals/goals.controller';
import { GoalsService } from './goals/goals.service';
import { RewardsController } from './rewards/rewards.controller';
import { RewardsService } from './rewards/rewards.service';
import { PlanFactController } from './plan-fact/plan-fact.controller';
import { PlanFactService } from './plan-fact/plan-fact.service';
import { PlanTargetsService } from './plan-fact/plan-targets.service';
import { WorkScheduleController } from './work-schedule/work-schedule.controller';
import { WorkScheduleService } from './work-schedule/work-schedule.service';
import { TaskCompletionsController } from './task-completions/task-completions.controller';
import { TaskCompletionsService } from './task-completions/task-completions.service';
import { SalaryAdjustmentsController } from './adjustments/salary-adjustments.controller';
import { SalaryAdjustmentsService } from './adjustments/salary-adjustments.service';
import { TurnoverController } from './turnover/turnover.controller';

@Module({
  controllers: [
    CategoriesController,
    DirectoryController,
    SalaryReportController,
    SalaryRulesController,
    GoalsController,
    RewardsController,
    PlanFactController,
    WorkScheduleController,
    TaskCompletionsController,
    SalaryAdjustmentsController,
    TurnoverController,
  ],
  providers: [
    CategoriesService,
    SalaryCalculationService,
    SalaryRulesService,
    GoalsService,
    RewardsService,
    PlanFactService,
    PlanTargetsService,
    WorkScheduleService,
    TaskCompletionsService,
    SalaryAdjustmentsService,
  ],
})
export class SalaryModule {}
