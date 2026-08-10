import { salaryRuleRegistry } from './salary-rule-registry';
import { PayPerHoursEntity } from './entities/salary-rules/pay-per-hour.entity';
import { ServiceCompletedEntity } from './entities/salary-rules/service-completed.entity';

describe('salaryRuleRegistry', () => {
    it('регистрирует классы правил по их типу', () => {
        expect(salaryRuleRegistry.get('PayPerHour')).toBe(PayPerHoursEntity);
        expect(salaryRuleRegistry.get('ServiceCompleted')).toBe(
            ServiceCompletedEntity,
        );
    });

    it('не содержит лишних типов', () => {
        expect(salaryRuleRegistry.size).toBe(2);
    });
});
