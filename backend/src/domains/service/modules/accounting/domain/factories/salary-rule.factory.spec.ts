import { NotFoundException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { SalaryRuleFactory } from './salary-rule.factory';
import { PayPerHoursEntity } from '../entities/salary-rules/pay-per-hour.entity';
import { ServiceCompletedEntity } from '../entities/salary-rules/service-completed.entity';

describe('SalaryRuleFactory', () => {
    it('создаёт PayPerHoursEntity для типа PayPerHour', () => {
        const rule = SalaryRuleFactory.create({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            config: { price: 100 },
        });

        expect(rule).toBeInstanceOf(PayPerHoursEntity);
    });

    it('создаёт ServiceCompletedEntity для типа ServiceCompleted', () => {
        const rule = SalaryRuleFactory.create({
            type: 'ServiceCompleted',
            name: 'За услугу',
            config: { award: { type: 'ServiceFixed' } },
        });

        expect(rule).toBeInstanceOf(ServiceCompletedEntity);
    });

    it('выбрасывает NotFoundException для незарегистрированного типа', () => {
        withRequestContext(() => {
            expect(() =>
                SalaryRuleFactory.create({
                    // Тип не зарегистрирован в salaryRuleRegistry (см.
                    // domain/entities/salary-rules/order-payed.entity.ts —
                    // сущность ещё не реализована).
                    type: 'OrderPayed' as never,
                    name: 'За оплаченный заказ',
                    config: {} as never,
                }),
            ).toThrow(NotFoundException);
        });
    });
});
