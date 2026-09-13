import { TurnoverReportRepository } from './turnover-report.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// tasks.md задача 6.1 (openspec/changes/add-department-head-salary-rules, design.md Decision 6b):
// TurnoverReportRepository — единственная точка чтения goods_turnover_report_lines внутри
// accounting/service, собственный Prisma-делегат (DatabaseService мокается напрямую, без реальной
// БД — тот же приём, что GoodsTurnoverReportLineRepository.spec.ts модуля warehouse), НЕ вызывает
// ни один сервис/репозиторий domains/service/modules/warehouse (root CLAUDE.md).
describe('TurnoverReportRepository', () => {
    const buildRepository = () => {
        const findMany = jest.fn();
        const client = {
            goodsTurnoverReportLine: { findMany },
        };
        const db = {
            getClient: () => client,
        } as unknown as DatabaseService;

        const repository = new TurnoverReportRepository(db);
        return { repository, findMany };
    };

    describe('findByPeriodAndWarehouse', () => {
        // FR4: восстановление снапшота напрямую из строк той же таблицы, что читает warehouse, но
        // собственным Prisma-запросом этого репозитория
        it('читает строки склада за период через собственный Prisma-делегат и восстанавливает снапшот', async () => {
            const { repository, findMany } = buildRepository();
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
                },
            ]);

            const snapshot = await repository.findByPeriodAndWarehouse(
                '2026-08',
                10,
            );

            expect(findMany).toHaveBeenCalledWith({
                where: { period: '2026-08', warehouseId: 10 },
            });
            expect(snapshot).not.toBeNull();
            expect(snapshot?.period).toBe('2026-08');
            expect(snapshot?.warehouseId).toBe(10);
            expect(snapshot?.lines).toHaveLength(1);
            expect(snapshot?.lines[0]).toEqual({
                categoryId: 1,
                outcomeSum: 5000,
                stockSum: 2000,
                stockQuantity: 2,
                turnoverRatio: 1.5,
            });
        });

        // FR4: период/склад без сохранённых строк — валидный null, не ошибка (отчёт ещё не
        // пересчитан, см. GetGoodsTurnoverReportService.get того же модуля warehouse)
        it('null, если строк за период и склад нет', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValueOnce([]);

            const snapshot = await repository.findByPeriodAndWarehouse(
                '2026-08',
                10,
            );

            expect(snapshot).toBeNull();
        });
    });
});
