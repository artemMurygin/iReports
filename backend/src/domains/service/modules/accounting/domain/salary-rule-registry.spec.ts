import { salaryRuleRegistry } from './salary-rule-registry';
import { PayPerHoursEntity } from './entities/salary-rules/pay-per-hour.entity';
import { ServiceCompletedEntity } from './entities/salary-rules/service-completed.entity';
import { OrderPayedEntity } from './entities/salary-rules/order-payed.entity';
import { TaskCompletion } from './entities/salary-rules/task-completion.entity';
import { DepartmentPercentEntity } from './entities/salary-rules/department-percent.entity';
import { DepartmentPlanBonusEntity } from './entities/salary-rules/department-plan-bonus.entity';
import { DepartmentTurnoverBonusEntity } from './entities/salary-rules/department-turnover-bonus.entity';

describe('salaryRuleRegistry', () => {
    it('регистрирует классы правил по их типу', () => {
        expect(salaryRuleRegistry.get('PayPerHour')).toBe(PayPerHoursEntity);
        expect(salaryRuleRegistry.get('ServiceCompleted')).toBe(
            ServiceCompletedEntity,
        );
        expect(salaryRuleRegistry.get('OrderPayed')).toBe(OrderPayedEntity);
        // Раздел 10 tasks.md (add-task-based-salary-rule).
        expect(salaryRuleRegistry.get('TaskCompletion')).toBe(TaskCompletion);
        // Implements FR2-FR4 of add-department-head-salary-rules (tasks.md раздел 12).
        expect(salaryRuleRegistry.get('DepartmentPercent')).toBe(
            DepartmentPercentEntity,
        );
        expect(salaryRuleRegistry.get('DepartmentPlanBonus')).toBe(
            DepartmentPlanBonusEntity,
        );
        expect(salaryRuleRegistry.get('DepartmentTurnoverBonus')).toBe(
            DepartmentTurnoverBonusEntity,
        );
    });

    it('не содержит лишних типов', () => {
        expect(salaryRuleRegistry.size).toBe(7);
    });
});
