import { SalaryAccrualMapper } from './salary-accrual.mapper';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual/salary-accrual.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('SalaryAccrualMapper', () => {
    const mapper = new SalaryAccrualMapper();

    it('toPersistence → toDomain сохраняет документ и строки один в один (порядок по position)', () => {
        const accrual = withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-08',
                employeeId: 42,
                isDismissed: true,
                total: 1500,
                lines: [
                    {
                        ruleId: 'r1',
                        type: 'PayPerHour',
                        name: 'Почасовая',
                        targetRole: 'ENGINEER',
                        quantity: 4,
                        rate: 250,
                        amount: 1000,
                        sources: [],
                    },
                    {
                        ruleId: 'r2',
                        type: 'OrderPayed',
                        name: 'Процент с заказа',
                        targetRole: 'ORDER_MANAGER',
                        salaryBasis: 'REVENUE',
                        rate: 5,
                        amount: 500,
                        sources: [{ type: 'order', id: 17 }],
                    },
                ],
            }),
        );

        const persisted = mapper.toPersistence(accrual);
        expect(persisted.accrual).toMatchObject({
            id: accrual.id,
            direction: 'service',
            period: '2026-08',
            employeeId: 42,
            status: 'DRAFT',
            isDismissed: true,
            total: 1500,
        });
        expect(persisted.lines).toHaveLength(2);
        expect(persisted.lines[1]).toMatchObject({
            accrualId: accrual.id,
            position: 1,
            ruleId: 'r2',
            salaryBasis: 'REVENUE',
            quantity: null,
            rate: 5,
            originalAmount: 500,
            amount: 500,
            status: 'DRAFT',
        });

        // Строки в обратном порядке — toDomain обязан отсортировать по position.
        const restored = withRequestContext(() =>
            mapper.toDomain({
                ...persisted.accrual,
                status: 'DRAFT',
                isDismissed: true,
                createdAt: new Date('2026-09-01T00:00:00Z'),
                updatedAt: new Date('2026-09-01T00:00:00Z'),
                lines: [...persisted.lines].reverse().map((line) => ({
                    ...line,
                    status: 'DRAFT' as const,
                    salaryBasis: line.salaryBasis ?? null,
                    quantity: line.quantity ?? null,
                    rate: line.rate ?? null,
                    sources: line.sources as unknown as object,
                    createdAt: new Date('2026-09-01T00:00:00Z'),
                    updatedAt: new Date('2026-09-01T00:00:00Z'),
                    // Prisma-запись всегда несёт adjustments (include в
                    // репозитории); здесь корректировок нет.
                    adjustments: [],
                })),
            }),
        );

        expect(restored.id).toBe(accrual.id);
        expect(restored.total).toBe(1500);
        expect(restored.isDismissed).toBe(true);
        expect(restored.lines.map((line) => line.ruleId)).toEqual(['r1', 'r2']);
        expect(restored.lines[0].salaryBasis).toBeUndefined();
        expect(restored.lines[1]).toMatchObject({
            salaryBasis: 'REVENUE',
            quantity: undefined,
            rate: 5,
            sources: [{ type: 'order', id: 17 }],
        });
    });
});
