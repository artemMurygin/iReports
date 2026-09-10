import { ShopTurnoverReportRepository } from './turnover-report.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// tasks.md задача 7.1 (openspec/changes/add-department-head-salary-rules, design.md Decision 6b):
// ShopTurnoverReportRepository — единственная точка чтения moy_sklad_turnover_report_lines внутри
// accounting/shop, собственный Prisma-делегат (DatabaseService мокается напрямую, без реальной БД —
// тот же приём, что GoodsTurnoverReportRepository.spec.ts модуля warehouse), НЕ вызывает ни один
// сервис/репозиторий domains/shop/modules/warehouse (root CLAUDE.md). В отличие от service,
// moy_sklad_turnover_report_lines не хранит коэффициент — репозиторий досчитывает его при чтении,
// сравнивая текущий период с предыдущим (design.md D8, дублирует формулу TurnoverCoefficient
// независимо).
describe('ShopTurnoverReportRepository', () => {
    const buildRepository = () => {
        const findMany = jest.fn();
        const client = {
            moySkladTurnoverReportLine: { findMany },
        };
        const db = {
            getClient: () => client,
        } as unknown as DatabaseService;

        const repository = new ShopTurnoverReportRepository(db);
        return { repository, findMany };
    };

    describe('findByPeriodAndWarehouse', () => {
        it('читает текущий и предыдущий период склада и восстанавливает снапшот с посчитанным коэффициентом', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockImplementation(
                ({
                    where,
                }: {
                    where: { period: string; warehouseId: string };
                }) => {
                    if (where.period === '2026-08') {
                        return Promise.resolve([
                            {
                                id: 'line-1',
                                period: '2026-08',
                                categoryId: 'cat-1',
                                warehouseId: 'wh-10',
                                turnoverQuantity: 5,
                                turnoverSum: 200,
                                stockQuantity: 2,
                                stockSum: 100,
                            },
                        ]);
                    }
                    if (where.period === '2026-07') {
                        return Promise.resolve([
                            {
                                id: 'line-0',
                                period: '2026-07',
                                categoryId: 'cat-1',
                                warehouseId: 'wh-10',
                                turnoverQuantity: 4,
                                turnoverSum: 150,
                                stockQuantity: 1,
                                stockSum: 100,
                            },
                        ]);
                    }
                    return Promise.resolve([]);
                },
            );

            const snapshot = await repository.findByPeriodAndWarehouse(
                '2026-08',
                'wh-10',
            );

            expect(findMany).toHaveBeenCalledWith({
                where: { period: '2026-08', warehouseId: 'wh-10' },
            });
            expect(findMany).toHaveBeenCalledWith({
                where: { period: '2026-07', warehouseId: 'wh-10' },
            });
            expect(snapshot).not.toBeNull();
            expect(snapshot?.period).toBe('2026-08');
            expect(snapshot?.warehouseId).toBe('wh-10');
            expect(snapshot?.lines).toHaveLength(1);
            const [line] = snapshot?.lines ?? [];
            expect(line?.categoryId).toBe('cat-1');
            expect(line?.turnoverSum).toBe(200);
            expect(line?.stockSum).toBe(100);
            expect(line?.stockQuantity).toBe(2);
            // avg(100, 100) = 100 -> 200 / 100 = 2
            expect(line?.coefficient).toBe(2);
        });

        it('коэффициент null для категории без строки за предыдущий период', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockImplementation(
                ({
                    where,
                }: {
                    where: { period: string; warehouseId: string };
                }) =>
                    where.period === '2026-08'
                        ? Promise.resolve([
                              {
                                  id: 'line-1',
                                  period: '2026-08',
                                  categoryId: 'cat-new',
                                  warehouseId: 'wh-10',
                                  turnoverQuantity: 1,
                                  turnoverSum: 500,
                                  stockQuantity: 1,
                                  stockSum: 500,
                              },
                          ])
                        : Promise.resolve([]),
            );

            const snapshot = await repository.findByPeriodAndWarehouse(
                '2026-08',
                'wh-10',
            );

            expect(snapshot?.lines[0]?.coefficient).toBeNull();
        });

        it('null, если строк за текущий период нет', async () => {
            const { repository, findMany } = buildRepository();
            findMany.mockResolvedValue([]);

            const snapshot = await repository.findByPeriodAndWarehouse(
                '2026-08',
                'wh-10',
            );

            expect(snapshot).toBeNull();
        });
    });
});
