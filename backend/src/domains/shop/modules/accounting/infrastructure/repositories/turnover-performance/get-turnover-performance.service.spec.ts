import { GetShopTurnoverPerformanceService } from './get-turnover-performance.service';
import type { DatabaseService } from '@/infrustructure/database/database.service';
import type { ShopTurnoverReportRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/turnover-report/turnover-report.port';
import { TurnoverReportSnapshot } from '@/domains/shop/modules/accounting/domain/entities/turnover-report/turnover-report-snapshot.entity';

// tasks.md задача 9.1 (openspec/changes/add-department-head-salary-rules, architecture.md
// "GetShopTurnoverPerformanceService") — зеркало
// domains/service/modules/accounting/infrastructure/repositories/turnover-performance/get-turnover-performance.service.spec.ts
// для shop: единственная реализация SHOP_TURNOVER_PERFORMANCE_READER — восстанавливает
// TurnoverReportSnapshot через SHOP_TURNOVER_REPORT_REPOSITORY (мок-порт), корневые категории для
// "весь склад" читает собственным Prisma-делегатом над moySkladProductFolder (DatabaseService
// мокается напрямую) — не вызывает ни один сервис/репозиторий domains/shop/modules/warehouse (root
// CLAUDE.md).
describe('GetShopTurnoverPerformanceService', () => {
    const buildService = () => {
        const findMany = jest.fn();
        const client = { moySkladProductFolder: { findMany } };
        const db = { getClient: () => client } as unknown as DatabaseService;

        const findByPeriodAndWarehouse = jest.fn();
        const turnoverReportRepository: ShopTurnoverReportRepositoryPort = {
            findByPeriodAndWarehouse,
        };

        const service = new GetShopTurnoverPerformanceService(
            db,
            turnoverReportRepository,
        );
        return { service, findMany, findByPeriodAndWarehouse };
    };

    describe('findForScope', () => {
        // FR4: недостаточно данных — за (period, warehouseId) в TurnoverReportSnapshot ни одной
        // строки
        it('null, если снапшота за период и склад нет', async () => {
            const { service, findByPeriodAndWarehouse } = buildService();
            findByPeriodAndWarehouse.mockResolvedValueOnce(null);

            const result = await service.findForScope('2026-08', 'wh-10', null);

            expect(result).toBeNull();
            expect(findByPeriodAndWarehouse).toHaveBeenCalledWith(
                '2026-08',
                'wh-10',
            );
        });

        // FR4, design.md Decision 2: "при заданной category — берёт коэффициент конкретной строки"
        it('при заданной category — коэффициент конкретной строки снапшота', async () => {
            const { service, findByPeriodAndWarehouse } = buildService();
            findByPeriodAndWarehouse.mockResolvedValueOnce(
                TurnoverReportSnapshot.create({
                    period: '2026-08',
                    warehouseId: 'wh-10',
                    lines: [
                        {
                            categoryId: 'cat-1',
                            turnoverSum: 100,
                            stockSum: 100,
                            stockQuantity: 5,
                            coefficient: 1,
                        },
                        {
                            categoryId: 'cat-2',
                            turnoverSum: 600,
                            stockSum: 300,
                            stockQuantity: 10,
                            coefficient: 2,
                        },
                    ],
                }),
            );

            const result = await service.findForScope(
                '2026-08',
                'wh-10',
                'cat-2',
            );

            expect(result).toBe(2);
        });

        it('null, если у указанной категории коэффициент не рассчитан', async () => {
            const { service, findByPeriodAndWarehouse } = buildService();
            findByPeriodAndWarehouse.mockResolvedValueOnce(
                TurnoverReportSnapshot.create({
                    period: '2026-08',
                    warehouseId: 'wh-10',
                    lines: [
                        {
                            categoryId: 'cat-1',
                            turnoverSum: 0,
                            stockSum: 0,
                            stockQuantity: 0,
                            coefficient: null,
                        },
                    ],
                }),
            );

            const result = await service.findForScope(
                '2026-08',
                'wh-10',
                'cat-1',
            );

            expect(result).toBeNull();
        });

        // FR4, design.md Decision 6b: "при category = null — берёт агрегат по всему складу" —
        // только строки настоящих корневых категорий, полученных собственным Prisma-запросом (не
        // через модуль warehouse).
        it('category = null — считает итог только по настоящим корневым категориям склада', async () => {
            const { service, findByPeriodAndWarehouse, findMany } =
                buildService();
            findMany.mockResolvedValueOnce([{ id: 'cat-1' }, { id: 'cat-2' }]);
            findByPeriodAndWarehouse.mockResolvedValueOnce(
                TurnoverReportSnapshot.create({
                    period: '2026-08',
                    warehouseId: 'wh-10',
                    lines: [
                        {
                            categoryId: 'cat-1',
                            turnoverSum: 100,
                            stockSum: 100,
                            stockQuantity: 5,
                            coefficient: 1,
                        },
                        {
                            categoryId: 'cat-2',
                            turnoverSum: 600,
                            stockSum: 300,
                            stockQuantity: 10,
                            coefficient: 2,
                        },
                        // подкатегория cat-1 — не должна попасть в итог по складу
                        {
                            categoryId: 'cat-1-sub',
                            turnoverSum: 9999,
                            stockSum: 9999,
                            stockQuantity: 99,
                            coefficient: 5,
                        },
                    ],
                }),
            );

            const result = await service.findForScope('2026-08', 'wh-10', null);

            expect(findMany).toHaveBeenCalledWith({
                where: { parentId: null },
                select: { id: true },
            });
            // (1*100 + 2*300) / 400 = 1.75
            expect(result).toBeCloseTo(1.75);
        });
    });
});
