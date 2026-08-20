import { OrderPayedEntity } from './order-payed.entity';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type {
    OrderPayedErpItem,
    ServiceCalculationErpData,
} from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { SalesPerformanceRequiredException } from '@/domains/service/modules/accounting/domain/exceptions/float-percent.exception';
import { PeriodCalculationOrchestrator } from '@/domains/service/modules/accounting/domain/services/period-calculation.orchestrator';
import { withRequestContext } from '@/shared/testing/with-request-context';

const buildItem = (
    overrides: Partial<OrderPayedErpItem> = {},
): OrderPayedErpItem => ({
    orderId: 1,
    managerId: null,
    onlineManager: null,
    engineerIds: [42],
    revenue: 1000,
    cost: 400,
    engineerSalary: 100,
    ...overrides,
});

const buildContext = (
    items: OrderPayedErpItem[],
    overrides: {
        identities?: CalculationContext['employee']['identities'];
        salesPerformance?: CalculationContext['salesPerformance'];
    } = {},
): CalculationContext => ({
    employee: {
        id: 1,
        identities: overrides.identities ?? [
            {
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '42',
            },
        ],
    },
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
        hoursWorked: 0,
        orderPayedItems: items,
        confirmedTaskCompletions: [],
    } satisfies ServiceCalculationErpData,
    salesPerformance: overrides.salesPerformance ?? null,
});

describe('OrderPayedEntity', () => {
    describe('create', () => {
        it('создаёт правило с генерируемым id и типом OrderPayed', () => {
            const rule = OrderPayedEntity.create({
                type: 'OrderPayed',
                name: 'За оплаченный заказ',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 500 } },
            });

            expect(rule.id).toEqual(expect.any(String));
            expect(rule.type).toBe('OrderPayed');
            expect(rule.targetRole).toBe('ENGINEER');
        });
    });

    describe('award Fixed', () => {
        it('платит фиксированную сумму за каждый совпавший заказ', () => {
            const rule = OrderPayedEntity.create({
                type: 'OrderPayed',
                name: 'За оплаченный заказ',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 500 } },
            });
            const items = [
                buildItem({ orderId: 1, engineerIds: [42] }),
                buildItem({ orderId: 2, engineerIds: [42] }),
            ];

            const line = rule.calculate(buildContext(items));

            expect(line).toEqual({
                ruleId: rule.id,
                quantity: 2,
                rate: 500,
                amount: 1000,
                sources: [
                    { type: 'order', id: 1 },
                    { type: 'order', id: 2 },
                ],
            });
        });
    });

    describe('award FixedPercent — все три salaryBasis', () => {
        const item = buildItem({
            revenue: 1000,
            cost: 400,
            engineerSalary: 100,
        });

        it('REVENUE — процент от выручки', () => {
            const rule = OrderPayedEntity.create({
                type: 'OrderPayed',
                name: 'Правило',
                targetRole: 'ENGINEER',
                config: {
                    award: {
                        type: 'FixedPercent',
                        percent: 10,
                        salaryBasis: 'REVENUE',
                    },
                },
            });

            const line = rule.calculate(buildContext([item]));
            expect(line.salaryBasis).toBe('REVENUE');
            expect(line.amount).toBe(100); // 1000 * 10%
        });

        it('MARGIN — процент от маржи (revenue - cost)', () => {
            const rule = OrderPayedEntity.create({
                type: 'OrderPayed',
                name: 'Правило',
                targetRole: 'ENGINEER',
                config: {
                    award: {
                        type: 'FixedPercent',
                        percent: 10,
                        salaryBasis: 'MARGIN',
                    },
                },
            });

            const line = rule.calculate(buildContext([item]));
            expect(line.amount).toBe(60); // (1000-400) * 10%
        });

        it('SALARY_MINUS_ENGINEER_SALARY — процент от суммы за вычетом зарплаты инженера', () => {
            const rule = OrderPayedEntity.create({
                type: 'OrderPayed',
                name: 'Правило',
                targetRole: 'ENGINEER',
                config: {
                    award: {
                        type: 'FixedPercent',
                        percent: 10,
                        salaryBasis: 'SALARY_MINUS_ENGINEER_SALARY',
                    },
                },
            });

            const line = rule.calculate(buildContext([item]));
            expect(line.amount).toBe(90); // (1000-100) * 10%
        });
    });

    describe('award FloatPercent — режимы FIX и LINEAR, выполнение плана 50/70/120%', () => {
        const buildRule = (mode: 'FIX' | 'LINEAR') =>
            OrderPayedEntity.create({
                type: 'OrderPayed',
                name: 'Правило',
                targetRole: 'ENGINEER',
                config: {
                    award: {
                        type: 'FloatPercent',
                        basePercent: 10,
                        salaryBasis: 'REVENUE',
                        percentBorders: [
                            {
                                name: 'A',
                                fromPlanPercent: 50,
                                multiplier: 0.5,
                                mode,
                            },
                            {
                                name: 'B',
                                fromPlanPercent: 70,
                                multiplier: 1,
                                mode,
                            },
                            {
                                name: 'C',
                                fromPlanPercent: 100,
                                multiplier: 1.5,
                                mode,
                            },
                        ],
                    },
                },
            });

        it('FIX — 50/70/120% выполнения плана дают три разных результата, соответствующих порогам', () => {
            const rule = buildRule('FIX');
            const item = buildItem({ revenue: 1000 });

            const at50 = rule.calculate(
                buildContext([item], {
                    salesPerformance: {
                        department: 1,
                        category: null,
                        percentCompletion: 50,
                    },
                }),
            ).amount;
            const at70 = rule.calculate(
                buildContext([item], {
                    salesPerformance: {
                        department: 1,
                        category: null,
                        percentCompletion: 70,
                    },
                }),
            ).amount;
            const at120 = rule.calculate(
                buildContext([item], {
                    salesPerformance: {
                        department: 1,
                        category: null,
                        percentCompletion: 120,
                    },
                }),
            ).amount;

            // base = 1000 * 10% = 100; множители ступенькой: 0.5 / 1 / 1.5
            expect(at50).toBe(50);
            expect(at70).toBe(100);
            expect(at120).toBe(150);
            expect(new Set([at50, at70, at120]).size).toBe(3);
        });

        it('LINEAR — интерполирует между порогами', () => {
            const rule = buildRule('LINEAR');
            const item = buildItem({ revenue: 1000 });

            // Между 50% (0.5) и 70% (1.0): на 60% — середина -> 0.75.
            const at60 = rule.calculate(
                buildContext([item], {
                    salesPerformance: {
                        department: 1,
                        category: null,
                        percentCompletion: 60,
                    },
                }),
            ).amount;

            expect(at60).toBe(75); // 1000 * 10% * 0.75
        });

        it('отсутствие плана на период даёт доменную ошибку', () => {
            const rule = buildRule('FIX');
            const item = buildItem({ revenue: 1000 });

            withRequestContext(() => {
                expect(() =>
                    rule.calculate(
                        buildContext([item], { salesPerformance: null }),
                    ),
                ).toThrow(SalesPerformanceRequiredException);
            });
        });
    });

    describe('роль ENGINEER — множество инженеров позиций заказа', () => {
        it('засчитывает заказ, если сотрудник инженер хотя бы одной позиции', () => {
            const rule = OrderPayedEntity.create({
                type: 'OrderPayed',
                name: 'Правило',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 100 } },
            });
            const items = [buildItem({ orderId: 1, engineerIds: [7, 42, 9] })];

            const line = rule.calculate(buildContext(items));
            expect(line.amount).toBe(100);
        });

        it('не засчитывает заказ без своего инженера', () => {
            const rule = OrderPayedEntity.create({
                type: 'OrderPayed',
                name: 'Правило',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 100 } },
            });
            const items = [buildItem({ orderId: 1, engineerIds: [7, 9] })];

            const line = rule.calculate(buildContext(items));
            expect(line.amount).toBe(0);
        });
    });

    describe('дедупликация по паре «правило × источник»', () => {
        it('один и тот же заказ не учитывается дважды в рамках одного правила', () => {
            const rule = OrderPayedEntity.create({
                type: 'OrderPayed',
                name: 'Правило',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 100 } },
            });
            // Один и тот же заказ теоретически мог бы попасть в выборку
            // дважды (например, при некорректной агрегации по нескольким
            // позициям источником данных) — дедупликация по orderId не
            // должна дать удвоенную сумму.
            const items = [
                buildItem({ orderId: 1, engineerIds: [42] }),
                buildItem({ orderId: 1, engineerIds: [42] }),
            ];

            const line = rule.calculate(buildContext(items));
            expect(line.quantity).toBe(1);
            expect(line.amount).toBe(100);
        });
    });

    describe('сотрудник в двух ролях по одному заказу — независимые правила', () => {
        it('оба правила разных ролей отрабатывают независимо, без двойной/потерянной суммы', async () => {
            const engineerRule = OrderPayedEntity.create({
                type: 'OrderPayed',
                name: 'За инженера',
                targetRole: 'ENGINEER',
                config: { award: { type: 'Fixed', price: 300 } },
            });
            const orderManagerRule = OrderPayedEntity.create({
                type: 'OrderPayed',
                name: 'За менеджера заказа',
                targetRole: 'ORDER_MANAGER',
                config: { award: { type: 'Fixed', price: 200 } },
            });
            // Один и тот же сотрудник (identity EMPLOYEE_ID=42) — и инженер,
            // и менеджер заказа одновременно.
            const items = [
                buildItem({
                    orderId: 1,
                    engineerIds: [42],
                    managerId: 42,
                }),
            ];
            const context = buildContext(items);

            const lines = await PeriodCalculationOrchestrator.calculate(
                [engineerRule, orderManagerRule],
                context,
            );

            expect(lines).toHaveLength(2);
            expect(lines[0].amount).toBe(300);
            expect(lines[1].amount).toBe(200);
            expect(PeriodCalculationOrchestrator.total(lines)).toBe(500);
        });
    });
});
