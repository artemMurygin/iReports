import { GoodsTurnoverReportRepository } from './goods-turnover-report.repository';
import { Period } from '@/shared/domain/period.value-object';
import { GoodsTurnoverReportLine } from '@/domains/shop/modules/warehouse/domain/entities/goods-turnover-report-line/goods-turnover-report-line.entity';
import { Money } from '@/domains/shop/modules/warehouse/domain/value-objects/money.value-object';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// Тесты на реальную логику replaceForPeriod (полная замена строк периода в
// одной транзакции) через мокнутый Prisma-клиент — по образцу
// domains/service/modules/accounting/infrastructure/repositories/erp-cash/
// payout-cashbox-record.repository.spec.ts: withTransaction здесь просто
// выполняет колбэк (без реальной Prisma-транзакции), но порядок и состав
// вызовов deleteMany/createMany внутри одного write() проверяют именно то,
// что в проде выполнится атомарно одной транзакцией.
describe('GoodsTurnoverReportRepository', () => {
    const buildLine = (
        overrides: Partial<{
            period: string;
            categoryId: string;
            warehouseId: string;
            turnoverSum: number;
            stockSum: number;
        }> = {},
    ) =>
        GoodsTurnoverReportLine.create({
            period: Period.create(overrides.period ?? '2026-08'),
            categoryId: overrides.categoryId ?? 'category-1',
            warehouseId: overrides.warehouseId ?? 'warehouse-1',
            turnoverQuantity: 10,
            turnoverSum: Money.ofKopecks(overrides.turnoverSum ?? 100_000),
            stockQuantity: 5,
            stockSum: Money.ofKopecks(overrides.stockSum ?? 50_000),
        });

    const buildRepository = () => {
        const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
        const createMany = jest.fn().mockResolvedValue({ count: 0 });
        const findMany = jest.fn().mockResolvedValue([]);
        const client = {
            moySkladTurnoverReportLine: { deleteMany, createMany, findMany },
        };
        const db = {
            getClient: () => client,
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        const repository = new GoodsTurnoverReportRepository(db);
        return { repository, deleteMany, createMany, findMany };
    };

    describe('replaceForPeriod', () => {
        it('удаляет старые строки периода и записывает новые одной транзакцией', async () => {
            const { repository, deleteMany, createMany } = buildRepository();
            const period = Period.create('2026-08');
            const lines = [
                buildLine({ categoryId: 'category-1' }),
                buildLine({ categoryId: 'category-2' }),
            ];

            await withRequestContext(() =>
                repository.replaceForPeriod(period, lines),
            );

            expect(deleteMany).toHaveBeenCalledTimes(1);
            expect(deleteMany).toHaveBeenCalledWith({
                where: { period: '2026-08' },
            });
            expect(createMany).toHaveBeenCalledTimes(1);
            const createManyCall = createMany.mock.calls[0] as unknown[];
            const createManyArg = createManyCall[0] as {
                data: Array<{ categoryId: string; period: string }>;
            };
            expect(createManyArg.data).toHaveLength(2);
            expect(createManyArg.data.map((line) => line.categoryId)).toEqual([
                'category-1',
                'category-2',
            ]);
            expect(
                createManyArg.data.every((line) => line.period === '2026-08'),
            ).toBe(true);

            // deleteMany должен выполниться раньше createMany внутри той же
            // транзакции — иначе createMany своих же новых строк тут же
            // удалит следующий deleteMany, если порядок перепутать.
            const deleteOrder = deleteMany.mock.invocationCallOrder[0];
            const createOrder = createMany.mock.invocationCallOrder[0];
            expect(deleteOrder).toBeLessThan(createOrder);
        });

        it('не затрагивает строки других периодов — deleteMany фильтрует строго по period', async () => {
            const { repository, deleteMany } = buildRepository();
            const period = Period.create('2026-09');

            await withRequestContext(() =>
                repository.replaceForPeriod(period, [
                    buildLine({ period: '2026-09' }),
                ]),
            );

            expect(deleteMany).toHaveBeenCalledWith({
                where: { period: '2026-09' },
            });
        });

        it('пустой список строк — deleteMany выполняется, createMany не вызывается', async () => {
            const { repository, deleteMany, createMany } = buildRepository();
            const period = Period.create('2026-08');

            await withRequestContext(() =>
                repository.replaceForPeriod(period, []),
            );

            expect(deleteMany).toHaveBeenCalledTimes(1);
            expect(createMany).not.toHaveBeenCalled();
        });
    });

    describe('findByPeriod', () => {
        it('читает строки периода через Prisma findMany с фильтром по period', async () => {
            const { repository, findMany } = buildRepository();
            const now = new Date('2026-08-31T10:00:00.000Z');
            findMany.mockResolvedValueOnce([
                {
                    id: 'line-1',
                    period: '2026-08',
                    categoryId: 'category-1',
                    warehouseId: 'warehouse-1',
                    turnoverQuantity: 10,
                    turnoverSum: 100_000,
                    stockQuantity: 5,
                    stockSum: 50_000,
                    createdAt: now,
                    updatedAt: now,
                },
            ]);

            const result = await repository.findByPeriod(
                Period.create('2026-08'),
            );

            expect(findMany).toHaveBeenCalledWith({
                where: { period: '2026-08' },
            });
            expect(result).toHaveLength(1);
            expect(result[0].categoryId).toBe('category-1');
            expect(result[0].turnoverSum.getValue()).toBe(100_000);
            expect(result[0].stockSum.getValue()).toBe(50_000);
            expect(result[0].period.getValue()).toBe('2026-08');
        });
    });
});
