import { ShopCalculationDataRepository } from './shop-calculation-data.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';
import type { ProductFolderTreeService } from '@/domains/shop/sync/moySklad/product-folder-tree.service';

// Зеркало service-calculation-data.repository.hours.spec.ts: findHoursWorked/
// findHoursWorkedForEmployees читают рабочие смены графика
// (WorkScheduleEntry.status = WORKING) с ролью дня ONLINE_MANAGER/
// OFFLINE_MANAGER из той же общей таблицы, что и у service
// (WorkScheduleEntry не имеет дискриминатора direction), и делят их на
// факт (по `now` включительно) и прогноз (весь период).
describe('ShopCalculationDataRepository — часы графика', () => {
    // folderTree не участвует ни в одном из тестов ниже (нужен только
    // resolveCategoryDescendantFolderIds) — минимальный фейк вместо
    // реального ProductFolderTreeService.
    const fakeFolderTree = {} as unknown as ProductFolderTreeService;

    describe('findHoursWorked', () => {
        it('запрашивает WORKING-смены с ролью ONLINE_MANAGER/OFFLINE_MANAGER в границах периода', async () => {
            const findMany = jest.fn().mockResolvedValue([]);
            const db = {
                getClient: () => ({
                    workScheduleEntry: { findMany },
                }),
            } as unknown as DatabaseService;
            const repository = new ShopCalculationDataRepository(
                db,
                fakeFolderTree,
            );

            await repository.findHoursWorked(
                42,
                '2026-08',
                new Date('2026-08-15T12:00:00.000Z'),
            );

            expect(findMany).toHaveBeenCalledWith({
                where: {
                    employeeId: 42,
                    status: 'WORKING',
                    role: { in: ['ONLINE_MANAGER', 'OFFLINE_MANAGER'] },
                    date: {
                        gte: new Date(Date.UTC(2026, 7, 1)),
                        lte: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)),
                    },
                },
                select: { date: true, hours: true },
            });
        });

        it('факт — сумма часов дней по `now` включительно, прогноз — сумма часов всего периода', async () => {
            const findMany = jest.fn().mockResolvedValue([
                { date: new Date(Date.UTC(2026, 7, 1)), hours: 8 },
                { date: new Date(Date.UTC(2026, 7, 15)), hours: 8 },
                { date: new Date(Date.UTC(2026, 7, 20)), hours: 8 },
            ]);
            const db = {
                getClient: () => ({ workScheduleEntry: { findMany } }),
            } as unknown as DatabaseService;
            const repository = new ShopCalculationDataRepository(
                db,
                fakeFolderTree,
            );

            const result = await repository.findHoursWorked(
                42,
                '2026-08',
                new Date('2026-08-15T12:00:00.000Z'),
            );

            expect(result).toEqual({ fact: 16, prognose: 24 });
        });

        it('нет подходящих рабочих смен за период — возвращает { fact: 0, prognose: 0 }', async () => {
            const findMany = jest.fn().mockResolvedValue([]);
            const db = {
                getClient: () => ({ workScheduleEntry: { findMany } }),
            } as unknown as DatabaseService;
            const repository = new ShopCalculationDataRepository(
                db,
                fakeFolderTree,
            );

            const result = await repository.findHoursWorked(42, '2026-08');

            expect(result).toEqual({ fact: 0, prognose: 0 });
        });
    });

    describe('findHoursWorkedForEmployees', () => {
        it('пустой список сотрудников — не ходит в БД, возвращает пустую карту', async () => {
            const findMany = jest.fn();
            const db = {
                getClient: () => ({ workScheduleEntry: { findMany } }),
            } as unknown as DatabaseService;
            const repository = new ShopCalculationDataRepository(
                db,
                fakeFolderTree,
            );

            const result = await repository.findHoursWorkedForEmployees(
                [],
                '2026-08',
            );

            expect(result).toEqual(new Map());
            expect(findMany).not.toHaveBeenCalled();
        });

        it('один запрос на весь отдел — сотрудник без подходящих рабочих смен не попадает в карту', async () => {
            const findMany = jest.fn().mockResolvedValue([
                {
                    employeeId: 1,
                    date: new Date(Date.UTC(2026, 7, 1)),
                    hours: 8,
                },
                {
                    employeeId: 1,
                    date: new Date(Date.UTC(2026, 7, 20)),
                    hours: 8,
                },
                {
                    employeeId: 2,
                    date: new Date(Date.UTC(2026, 7, 1)),
                    hours: 4,
                },
            ]);
            const db = {
                getClient: () => ({ workScheduleEntry: { findMany } }),
            } as unknown as DatabaseService;
            const repository = new ShopCalculationDataRepository(
                db,
                fakeFolderTree,
            );

            const result = await repository.findHoursWorkedForEmployees(
                [1, 2, 3],
                '2026-08',
                new Date('2026-08-15T00:00:00.000Z'),
            );

            expect(findMany).toHaveBeenCalledTimes(1);
            expect(result).toEqual(
                new Map([
                    [1, { fact: 8, prognose: 16 }],
                    [2, { fact: 4, prognose: 4 }],
                ]),
            );
            expect(result.has(3)).toBe(false);
        });
    });
});
