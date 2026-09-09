import { NotFoundException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { SalaryRuleFactory } from './salary-rule.factory';
import { PayPerHoursEntity } from '../entities/salary-rules/pay-per-hour.entity';
import { ServiceCompletedEntity } from '../entities/salary-rules/service-completed.entity';
import { OrderPayedEntity } from '../entities/salary-rules/order-payed.entity';
import { TaskCompletion } from '../entities/salary-rules/task-completion.entity';

describe('SalaryRuleFactory', () => {
    it('создаёт PayPerHoursEntity для типа PayPerHour', () => {
        const rule = SalaryRuleFactory.create({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ENGINEER',
            config: { price: 100 },
        });

        expect(rule).toBeInstanceOf(PayPerHoursEntity);
    });

    it('создаёт ServiceCompletedEntity для типа ServiceCompleted', () => {
        const rule = SalaryRuleFactory.create({
            type: 'ServiceCompleted',
            name: 'За услугу',
            targetRole: 'ENGINEER',
            config: { award: { type: 'ServiceFixed' } },
        });

        expect(rule).toBeInstanceOf(ServiceCompletedEntity);
    });

    it('создаёт OrderPayedEntity для типа OrderPayed', () => {
        const rule = SalaryRuleFactory.create({
            type: 'OrderPayed',
            name: 'За оплаченный заказ',
            targetRole: 'ENGINEER',
            config: { award: { type: 'Fixed', price: 100 } },
        });

        expect(rule).toBeInstanceOf(OrderPayedEntity);
    });

    it('создаёт TaskCompletion для типа TaskCompletion', () => {
        const rule = SalaryRuleFactory.create({
            type: 'TaskCompletion',
            name: 'За выполнение задачи',
            targetRole: 'ENGINEER',
            config: {
                bitrixTaskTitle: 'Проверить остатки',
                isRecurring: false,
                deadlineTemplate: '2026-08-15',
                defaultAmount: 5000,
            },
        });

        expect(rule).toBeInstanceOf(TaskCompletion);
    });

    it('выбрасывает NotFoundException для незарегистрированного типа', () => {
        withRequestContext(() => {
            expect(() =>
                SalaryRuleFactory.create({
                    // Тип не зарегистрирован в salaryRuleRegistry этого
                    // домена (все три типа сервиса — Фазы 1/7/8 — уже
                    // реализованы; используем заведомо отсутствующий тип).
                    type: 'UnknownRuleType' as never,
                    name: 'Неизвестное правило',
                    targetRole: 'ENGINEER' as never,
                    config: {} as never,
                }),
            ).toThrow(NotFoundException);
        });
    });
});
