import { salaryRuleRegistry } from './salary-rule-registry';
import { PayPerHoursEntity } from './entities/salary-rules/pay-per-hour.entity';
import { ServiceCompletedEntity } from './entities/salary-rules/service-completed.entity';
import { OrderPayedEntity } from './entities/salary-rules/order-payed.entity';
import { TaskCompletedEntity } from './entities/salary-rules/task-completed.entity';

describe('salaryRuleRegistry', () => {
    it('регистрирует классы правил по их типу', () => {
        expect(salaryRuleRegistry.get('PayPerHour')).toBe(PayPerHoursEntity);
        expect(salaryRuleRegistry.get('ServiceCompleted')).toBe(
            ServiceCompletedEntity,
        );
        expect(salaryRuleRegistry.get('OrderPayed')).toBe(OrderPayedEntity);
        expect(salaryRuleRegistry.get('TaskCompleted')).toBe(
            TaskCompletedEntity,
        );
    });

    it('не содержит лишних типов', () => {
        expect(salaryRuleRegistry.size).toBe(4);
    });
});
