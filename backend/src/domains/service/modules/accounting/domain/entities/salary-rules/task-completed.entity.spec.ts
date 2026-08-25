import { TaskCompletedEntity } from './task-completed.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type {
    ConfirmedTaskCompletionErpItem,
    ServiceCalculationErpData,
} from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { SalesPerformanceRequiredException } from '@/domains/service/modules/accounting/domain/exceptions/float-percent.exception';
import { withRequestContext } from '@/shared/testing/with-request-context';

const buildContext = (
    completions: ConfirmedTaskCompletionErpItem[],
    salesPerformance: CalculationContext['salesPerformance'] = null,
    employeeId = 1,
): CalculationContext => ({
    employee: { id: employeeId, identities: [] },
    period: {
        direction: 'service',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode: 'FACT',
    erpData: {
        serviceCompletedItems: [],
        hoursWorked: { fact: 0, prognose: 0 },
        orderPayedItems: [],
        confirmedTaskCompletions: completions,
    } satisfies ServiceCalculationErpData,
    salesPerformance,
});

describe('TaskCompletedEntity', () => {
    describe('award Fixed', () => {
        it('платит фиксированную сумму за каждую подтверждённую задачу сотрудника', () => {
            const rule = TaskCompletedEntity.create({
                type: 'TaskCompleted',
                name: 'За задачу',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 200 } },
            });
            const completions = [
                { id: 't1', employeeId: 1 },
                { id: 't2', employeeId: 1 },
                // Чужая задача — не должна попасть в выборку.
                { id: 't3', employeeId: 2 },
            ];

            const line = rule.calculate(buildContext(completions));

            expect(line).toEqual({
                ruleId: rule.id,
                quantity: 2,
                rate: 200,
                amount: 400,
                sources: [
                    { type: 'taskCompletion', id: 't1', amount: 200 },
                    { type: 'taskCompletion', id: 't2', amount: 200 },
                ],
            });
        });

        it('без подтверждённых задач возвращает нулевую сумму', () => {
            const rule = TaskCompletedEntity.create({
                type: 'TaskCompleted',
                name: 'За задачу',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 200 } },
            });

            expect(rule.calculate(buildContext([])).amount).toBe(0);
        });
    });

    describe('award FloatPercent', () => {
        const buildRule = () =>
            TaskCompletedEntity.create({
                type: 'TaskCompleted',
                name: 'За задачу',
                targetRole: 'ENGINEER',
                config: {
                    award: {
                        type: 'FloatPercent',
                        basePrice: 100,
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
                },
            });

        it('множитель зависит от процента выполнения плана', () => {
            const rule = buildRule();
            const completions = [
                { id: 't1', employeeId: 1 },
                { id: 't2', employeeId: 1 },
            ];

            const at50 = rule.calculate(
                buildContext(completions, {
                    department: 1,
                    category: null,
                    percentCompletion: 50,
                }),
            ).amount;
            const at120 = rule.calculate(
                buildContext(completions, {
                    department: 1,
                    category: null,
                    percentCompletion: 120,
                }),
            ).amount;

            // basePrice(100) * quantity(2) * multiplier.
            expect(at50).toBe(100); // 100*2*0.5
            expect(at120).toBe(300); // 100*2*1.5
        });

        it('отсутствие плана на период даёт доменную ошибку', () => {
            const rule = buildRule();

            withRequestContext(() => {
                expect(() =>
                    rule.calculate(
                        buildContext([{ id: 't1', employeeId: 1 }], null),
                    ),
                ).toThrow(SalesPerformanceRequiredException);
            });
        });
    });
});
