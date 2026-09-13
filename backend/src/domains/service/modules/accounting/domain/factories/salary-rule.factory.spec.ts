import { NotFoundException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { SalaryRuleFactory } from './salary-rule.factory';
import { PayPerHoursEntity } from '../entities/salary-rules/pay-per-hour.entity';
import { ServiceCompletedEntity } from '../entities/salary-rules/service-completed.entity';
import { OrderPayedEntity } from '../entities/salary-rules/order-payed.entity';
import { TaskCompletion } from '../entities/salary-rules/task-completion.entity';
import { DepartmentPercentEntity } from '../entities/salary-rules/department-percent.entity';
import { DepartmentPlanBonusEntity } from '../entities/salary-rules/department-plan-bonus.entity';
import { DepartmentTurnoverBonusEntity } from '../entities/salary-rules/department-turnover-bonus.entity';

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
                taskId: 'a1b2c3d4-0000-4000-8000-000000000001',
                taskTitleTemplate: 'Проверить остатки',
                isRecurring: false,
                deadlineTemplate: '2026-08-15',
                defaultAmount: 5000,
            },
        });

        expect(rule).toBeInstanceOf(TaskCompletion);
    });

    it('restore() передаёт переданный isActive в восстановленную сущность', () => {
        const activeRule = SalaryRuleFactory.restore(
            'rule-1',
            {
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price: 100 },
            },
            true,
        );
        const inactiveRule = SalaryRuleFactory.restore(
            'rule-2',
            {
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price: 100 },
            },
            false,
        );

        expect(activeRule.isActive).toBe(true);
        expect(inactiveRule.isActive).toBe(false);
    });

    // Implements FR2 of add-department-head-salary-rules (tasks.md раздел 12).
    it('создаёт DepartmentPercentEntity для типа DepartmentPercent', () => {
        const rule = SalaryRuleFactory.create({
            type: 'DepartmentPercent',
            name: 'Процент от факта',
            targetRole: 'DEPARTMENT_HEAD',
            config: { salaryBasis: 'REVENUE', category: null, percent: 5 },
        });

        expect(rule).toBeInstanceOf(DepartmentPercentEntity);
    });

    // Implements FR3 of add-department-head-salary-rules (tasks.md раздел 12).
    it('создаёт DepartmentPlanBonusEntity для типа DepartmentPlanBonus', () => {
        const rule = SalaryRuleFactory.create({
            type: 'DepartmentPlanBonus',
            name: 'Бонус за план',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                salaryBasis: 'REVENUE',
                category: null,
                fixedAmount: 10000,
                percentBorders: [
                    {
                        name: 'A',
                        fromPlanPercent: 50,
                        multiplier: 0.5,
                        mode: 'FIX',
                    },
                    {
                        name: 'B',
                        fromPlanPercent: 70,
                        multiplier: 1,
                        mode: 'FIX',
                    },
                    {
                        name: 'C',
                        fromPlanPercent: 100,
                        multiplier: 1.5,
                        mode: 'FIX',
                    },
                ],
            },
        });

        expect(rule).toBeInstanceOf(DepartmentPlanBonusEntity);
    });

    // Implements FR4 of add-department-head-salary-rules (tasks.md раздел 12).
    it('создаёт DepartmentTurnoverBonusEntity для типа DepartmentTurnoverBonus', () => {
        const rule = SalaryRuleFactory.create({
            type: 'DepartmentTurnoverBonus',
            name: 'Бонус за оборачиваемость',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                warehouseId: 1,
                category: null,
                fixedAmount: 5000,
                planTurnoverRatio: 1,
                percentBorders: [
                    {
                        name: 'A',
                        fromPlanPercent: 50,
                        multiplier: 0.5,
                        mode: 'FIX',
                    },
                    {
                        name: 'B',
                        fromPlanPercent: 70,
                        multiplier: 1,
                        mode: 'FIX',
                    },
                    {
                        name: 'C',
                        fromPlanPercent: 100,
                        multiplier: 1.5,
                        mode: 'FIX',
                    },
                ],
            },
        });

        expect(rule).toBeInstanceOf(DepartmentTurnoverBonusEntity);
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
