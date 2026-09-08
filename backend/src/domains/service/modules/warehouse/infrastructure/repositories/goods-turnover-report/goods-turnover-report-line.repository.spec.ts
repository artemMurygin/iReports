import { GoodsTurnoverReportLineRepository } from './goods-turnover-report-line.repository';
import { GoodsTurnoverReportLine } from '@/domains/service/modules/warehouse/domain/entities/goods-turnover-report/goods-turnover-report-line.entity';
import { GoodsFlowMetric } from '@/domains/service/modules/warehouse/domain/value-objects/goods-flow-metric.value-object';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// 8.1-8.4 (openspec/changes/service-turnover-report/tasks.md): TDD по образцу
// AccountingPeriodSnapshotRepository/PayoutCashboxRecordRepository —
// DatabaseService мокается напрямую (getClient/withTransaction), без
// реальной БД.
describe('GoodsTurnoverReportLineRepository', () => {
    const buildRepository = () => {
        const findMany = jest.fn();
        const deleteMany = jest.fn();
        const createMany = jest.fn();
        const client = {
            goodsTurnoverReportLine: { findMany, deleteMany, createMany },
        };
        const db = {
            getClient: () => client,
            // write() делегирует в db.withTransaction — без реальной
            // Prisma-транзакции, просто выполняет колбэк (см.
            // PayoutCashboxRecordRepository.spec.ts за тем же приёмом).
            withTransaction: (callback: () => Promise<unknown>) => callback(),
        } as unknown as DatabaseService;

        const repository = new GoodsTurnoverReportLineRepository(db);
        return { repository, findMany, deleteMany, createMany };
    };

    const buildLine = (
        overrides: Partial<{
            categoryId: number;
            warehouseId: number;
            outcome: GoodsFlowMetric;
            stock: GoodsFlowMetric;
        }> = {},
    ) =>
        GoodsTurnoverReportLine.create({
            period: '2026-08',
            categoryId: overrides.categoryId ?? 1,
            warehouseId: overrides.warehouseId ?? 10,
            outcome: overrides.outcome ?? GoodsFlowMetric.create(5, 5000),
            stock: overrides.stock ?? GoodsFlowMetric.create(2, 2000),
        });

    describe('findByPeriod', () => {
        it('маппит строки Prisma-модели в доменные сущности', async () => {
            const { repository, findMany } = buildRepository();
            const now = new Date('2026-08-31T10:00:00.000Z');
            findMany.mockResolvedValueOnce([
                {
                    id: 'line-1',
                    period: '2026-08',
                    categoryId: 1,
                    warehouseId: 10,
                    outcomeQuantity: 5,
                    outcomeSum: 5000,
                    stockQuantity: 2,
                    stockSum: 2000,
                    turnoverRatio: 1.5,
                    createdAt: now,
                    updatedAt: now,
                },
            ]);

            const result = await repository.findByPeriod('2026-08');

            expect(findMany).toHaveBeenCalledWith({
                where: { period: '2026-08' },
            });
            expect(result).toHaveLength(1);
            expect(result[0]?.id).toBe('line-1');
            expect(result[0]?.categoryId).toBe(1);
            expect(result[0]?.warehouseId).toBe(10);
            expect(result[0]?.outcome.quantity).toBe(5);
            expect(result[0]?.outcome.sum).toBe(5000);
            expect(result[0]?.stock.quantity).toBe(2);
            expect(result[0]?.stock.sum).toBe(2000);
            expect(result[0]?.turnoverRatio).toBe(1.5);
        });

        it('нет сохранённых строк — пустой список, не ошибка', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            const result = await repository.findByPeriod('2026-08');

            expect(result).toEqual([]);
        });
    });

    describe('replaceAll', () => {
        it('удаляет существующие строки периода и вставляет переданные', async () => {
            const { repository, deleteMany, createMany } = buildRepository();
            deleteMany.mockResolvedValueOnce({ count: 0 });
            createMany.mockResolvedValueOnce({ count: 1 });
            const line = buildLine();

            await withRequestContext(() =>
                repository.replaceAll('2026-08', [line]),
            );

            expect(deleteMany).toHaveBeenCalledWith({
                where: { period: '2026-08' },
            });
            expect(createMany).toHaveBeenCalledTimes(1);
            const call = createMany.mock.calls[0][0] as {
                data: Array<{ categoryId: number; warehouseId: number }>;
            };
            expect(call.data).toHaveLength(1);
            expect(call.data[0]?.categoryId).toBe(1);
            expect(call.data[0]?.warehouseId).toBe(10);
            // deleteMany должен произойти до createMany, иначе только что
            // вставленные строки удалятся вслед за старыми (порядок
            // операций внутри одной транзакции важен так же, как в
            // AccountingPeriodSnapshotRepository.saveAll).
            expect(deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
                createMany.mock.invocationCallOrder[0],
            );
        });

        it('пустой список строк — очищает период, createMany не вызывается', async () => {
            const { repository, deleteMany, createMany } = buildRepository();
            deleteMany.mockResolvedValueOnce({ count: 3 });

            await withRequestContext(() =>
                repository.replaceAll('2026-08', []),
            );

            expect(deleteMany).toHaveBeenCalledWith({
                where: { period: '2026-08' },
            });
            expect(createMany).not.toHaveBeenCalled();
        });
    });
});
