import { GetTurnoverPerformanceService } from './get-turnover-performance.service';
import type { DatabaseService } from '@/infrustructure/database/database.service';
import type { TurnoverReportRepositoryPort } from '@/domains/service/modules/accounting/application/ports/turnover-report/turnover-report.port';
import { TurnoverReportSnapshot } from '@/domains/service/modules/accounting/domain/entities/turnover-report/turnover-report-snapshot.entity';

// tasks.md задача 8.1 (openspec/changes/add-department-head-salary-rules, architecture.md
// "GetTurnoverPerformanceService"): единственная реализация TURNOVER_PERFORMANCE_READER —
// восстанавливает TurnoverReportSnapshot через TURNOVER_REPORT_REPOSITORY (мок-порт, без реальной
// БД), корневые категории для "весь склад" читает собственным Prisma-делегатом над
// roappProductCategory (DatabaseService мокается напрямую) — не вызывает ни один
// сервис/репозиторий domains/service/modules/warehouse (root CLAUDE.md).
describe('GetTurnoverPerformanceService', () => {
    const buildService = () => {
        const findMany = jest.fn();
        const client = { roappProductCategory: { findMany } };
        const db = { getClient: () => client } as unknown as DatabaseService;

        const findByPeriodAndWarehouse = jest.fn();
        const turnoverReportRepository: TurnoverReportRepositoryPort = {
            findByPeriodAndWarehouse,
        };

        const service = new GetTurnoverPerformanceService(
            db,
            turnoverReportRepository,
        );
        return { service, findMany, findByPeriodAndWarehouse };
    };

    describe('findForScope', () => {
        // FR4: недостаточно данных — за (period, warehouseId) в TurnoverReportSnapshot ни одной
        // строки (отчёт ещё не пересчитан)
        it('null, если снапшота за период и склад нет', async () => {
            const { service, findByPeriodAndWarehouse } = buildService();
            findByPeriodAndWarehouse.mockResolvedValueOnce(null);

            const result = await service.findForScope('2026-08', 10, null);

            expect(result).toBeNull();
            expect(findByPeriodAndWarehouse).toHaveBeenCalledWith(
                '2026-08',
                10,
            );
        });

        // FR4, design.md Decision 2: "при заданной category — берёт коэффициент конкретной строки"
        it('при заданной category — коэффициент конкретной строки снапшота', async () => {
            const { service, findByPeriodAndWarehouse } = buildService();
            findByPeriodAndWarehouse.mockResolvedValueOnce(
                TurnoverReportSnapshot.create({
                    period: '2026-08',
                    warehouseId: 10,
                    lines: [
                        {
                            categoryId: 1,
                            outcomeSum: 100,
                            stockSum: 100,
                            stockQuantity: 5,
                            turnoverRatio: 1,
                        },
                        {
                            categoryId: 2,
                            outcomeSum: 600,
                            stockSum: 300,
                            stockQuantity: 10,
                            turnoverRatio: 2,
                        },
                    ],
                }),
            );

            const result = await service.findForScope('2026-08', 10, 2);

            expect(result).toBe(2);
        });

        it('null, если у указанной категории коэффициент не рассчитан', async () => {
            const { service, findByPeriodAndWarehouse } = buildService();
            findByPeriodAndWarehouse.mockResolvedValueOnce(
                TurnoverReportSnapshot.create({
                    period: '2026-08',
                    warehouseId: 10,
                    lines: [
                        {
                            categoryId: 1,
                            outcomeSum: 0,
                            stockSum: 0,
                            stockQuantity: 0,
                            turnoverRatio: null,
                        },
                    ],
                }),
            );

            const result = await service.findForScope('2026-08', 10, 1);

            expect(result).toBeNull();
        });

        // FR4, design.md Decision 6b: "при category = null — берёт агрегат по всему складу из
        // своей TurnoverReportSnapshot" — только строки настоящих корневых категорий, полученных
        // собственным Prisma-запросом (не через модуль warehouse).
        it('category = null — считает итог только по настоящим корневым категориям склада', async () => {
            const { service, findByPeriodAndWarehouse, findMany } =
                buildService();
            findMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
            findByPeriodAndWarehouse.mockResolvedValueOnce(
                TurnoverReportSnapshot.create({
                    period: '2026-08',
                    warehouseId: 10,
                    lines: [
                        {
                            categoryId: 1,
                            outcomeSum: 100,
                            stockSum: 100,
                            stockQuantity: 5,
                            turnoverRatio: 1,
                        },
                        {
                            categoryId: 2,
                            outcomeSum: 600,
                            stockSum: 300,
                            stockQuantity: 10,
                            turnoverRatio: 2,
                        },
                        // подкатегория 1 — не должна попасть в итог по складу
                        {
                            categoryId: 3,
                            outcomeSum: 9999,
                            stockSum: 9999,
                            stockQuantity: 99,
                            turnoverRatio: 5,
                        },
                    ],
                }),
            );

            const result = await service.findForScope('2026-08', 10, null);

            expect(findMany).toHaveBeenCalledWith({
                where: { parentId: null },
                select: { id: true },
            });
            // (1*100 + 2*300) / 400 = 1.75
            expect(result).toBeCloseTo(1.75);
        });
    });
});
