import { TaskCompletedShopEntity } from './task-completed.entity';
import type { ShopCalculationContext } from '@/domains/shop/modules/accounting/domain/types/calculation-context.types';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';
import { ShopSalesPerformanceRequiredException } from '@/domains/shop/modules/accounting/domain/exceptions/float-percent.exception';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Юнит-тесты на подготовленном объекте контекста — без БД и без моков
// репозиториев (issue #66, "Тесты TaskCompleted магазина: оба award").

const buildContext = (
    employeeId: number,
    completions: ShopCalculationErpData['taskCompletions'],
    salesPerformance: ShopCalculationContext['salesPerformance'] = null,
): ShopCalculationContext => ({
    employee: { id: employeeId, identities: [] },
    period: {
        direction: 'shop',
        period: '2026-08',
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-31T23:59:59.999Z'),
        status: 'OPEN',
    },
    mode: 'FACT',
    erpData: { taskCompletions: completions } satisfies ShopCalculationErpData,
    salesPerformance,
});

describe('TaskCompletedShopEntity', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id и типом TaskCompleted', () => {
            const rule = TaskCompletedShopEntity.create({
                type: 'TaskCompleted',
                name: 'За выполненную задачу',
                targetRole: 'ONLINE_MANAGER',
                config: { award: { type: 'Fixed', price: 200 } },
            });

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('TaskCompleted');
        });
    });

    describe('award Fixed', () => {
        it('платит фиксированную сумму за каждую выполненную задачу сотрудника', () => {
            const rule = TaskCompletedShopEntity.create({
                type: 'TaskCompleted',
                name: 'За выполненную задачу',
                targetRole: 'ONLINE_MANAGER',
                config: { award: { type: 'Fixed', price: 200 } },
            });
            const completions = [
                { id: 't1', employeeId: 1 },
                { id: 't2', employeeId: 1 },
                { id: 't3', employeeId: 2 },
            ];

            const line = rule.calculate(buildContext(1, completions));

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

        it('без задач сотрудника в периоде — ноль', () => {
            const rule = TaskCompletedShopEntity.create({
                type: 'TaskCompleted',
                name: 'За выполненную задачу',
                targetRole: 'ONLINE_MANAGER',
                config: { award: { type: 'Fixed', price: 200 } },
            });

            expect(rule.calculate(buildContext(1, [])).amount).toBe(0);
        });
    });

    describe('award FloatPercent', () => {
        const percentBorders = [
            {
                name: 'A',
                fromPlanPercent: 50,
                multiplier: 0.5,
                mode: 'FIX' as const,
            },
            {
                name: 'B',
                fromPlanPercent: 80,
                multiplier: 1,
                mode: 'FIX' as const,
            },
            {
                name: 'C',
                fromPlanPercent: 100,
                multiplier: 1.5,
                mode: 'FIX' as const,
            },
        ];

        it('бросает ShopSalesPerformanceRequiredException без SalesPerformance в контексте', () => {
            withRequestContext(() => {
                const rule = TaskCompletedShopEntity.create({
                    type: 'TaskCompleted',
                    name: 'За выполненную задачу',
                    targetRole: 'ONLINE_MANAGER',
                    config: {
                        award: {
                            type: 'FloatPercent',
                            basePrice: 100,
                            percentBorders,
                        },
                    },
                });

                expect(() =>
                    rule.calculate(
                        buildContext(1, [{ id: 't1', employeeId: 1 }]),
                    ),
                ).toThrow(ShopSalesPerformanceRequiredException);
            });
        });

        it('меняет результат при разном проценте выполнения плана', () => {
            const rule = TaskCompletedShopEntity.create({
                type: 'TaskCompleted',
                name: 'За выполненную задачу',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    award: {
                        type: 'FloatPercent',
                        basePrice: 100,
                        percentBorders,
                    },
                },
            });
            const completions = [{ id: 't1', employeeId: 1 }];

            const low = rule.calculate(
                buildContext(1, completions, new Map([[null, 60]])),
            ).amount;
            const high = rule.calculate(
                buildContext(1, completions, new Map([[null, 100]])),
            ).amount;

            // 60% -> множитель предыдущего порога (0.5): 100 * 1 * 0.5 = 50
            expect(low).toBe(50);
            // 100% -> множитель старшего порога (1.5): 100 * 1 * 1.5 = 150
            expect(high).toBe(150);
            expect(low).not.toBe(high);
        });
    });
});
