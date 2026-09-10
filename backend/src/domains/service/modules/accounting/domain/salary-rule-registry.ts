import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import {
    SalaryRuleClass,
    SalaryRuleTypes,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { ServiceCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/service-completed.entity';
import { OrderPayedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/order-payed.entity';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import { DepartmentPercentEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/department-percent.entity';
import { DepartmentPlanBonusEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/department-plan-bonus.entity';
import { DepartmentTurnoverBonusEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/department-turnover-bonus.entity';

// Implements FR2-FR4 of add-department-head-salary-rules (tasks.md раздел 12) — 3 новых вида
// правила уровня отдела/направления зарегистрированы наравне с 4 существующими; salaryRuleTypeSchema
// (infrastructure/schemas/salary-rule.schema.ts) выводит список типов из ключей этой Map, поэтому
// регистрация здесь — единственное место, которое нужно менять, чтобы валидация БД/каталог типов
// узнали о новом типе.
export const salaryRuleRegistry = new Map<SalaryRuleTypes, SalaryRuleClass>([
    ['PayPerHour', PayPerHoursEntity],
    ['ServiceCompleted', ServiceCompletedEntity],
    ['OrderPayed', OrderPayedEntity],
    ['TaskCompletion', TaskCompletion],
    ['DepartmentPercent', DepartmentPercentEntity],
    ['DepartmentPlanBonus', DepartmentPlanBonusEntity],
    ['DepartmentTurnoverBonus', DepartmentTurnoverBonusEntity],
]);
