import { ServiceCalculationDataRepository } from './service-calculation-data.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// Фаза 5 (docs/employee-work-schedule): findHoursWorked/findHoursWorkedForEmployees
// читают сумму часов рабочих смен графика (WorkScheduleEntry.status =
// WORKING) вместо прежнего ручного ввода EmployeeHoursEntry. Тот же приём
// мока DatabaseService, что и в moysklad-sales-fact-source.repository.spec.ts
// / directory.repository.spec.ts — PrismaRepository.client делегирует в
// db.getClient(), фейковому db достаточно реализовать только этот метод.
describe('ServiceCalculationDataRepository — часы графика', () => {
    describe('findHoursWorked', () => {
        it('запрашивает сумму часов WORKING-смен сотрудника в границах периода', async () => {
            const aggregate = jest
                .fn()
                .mockResolvedValue({ _sum: { hours: 24 } });
            const db = {
                getClient: () => ({
                    workScheduleEntry: { aggregate },
                }),
            } as unknown as DatabaseService;
            const repository = new ServiceCalculationDataRepository(db);

            const result = await repository.findHoursWorked(42, '2026-08');

            expect(result).toBe(24);
            expect(aggregate).toHaveBeenCalledWith({
                where: {
                    employeeId: 42,
                    status: 'WORKING',
                    date: {
                        gte: new Date(Date.UTC(2026, 7, 1)),
                        lte: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)),
                    },
                },
                _sum: { hours: true },
            });
        });

        it('нет рабочих смен за период — возвращает 0, а не null/ошибку', async () => {
            const aggregate = jest
                .fn()
                .mockResolvedValue({ _sum: { hours: null } });
            const db = {
                getClient: () => ({ workScheduleEntry: { aggregate } }),
            } as unknown as DatabaseService;
            const repository = new ServiceCalculationDataRepository(db);

            const result = await repository.findHoursWorked(42, '2026-08');

            expect(result).toBe(0);
        });
    });

    describe('findHoursWorkedForEmployees', () => {
        it('пустой список сотрудников — не ходит в БД, возвращает пустую карту', async () => {
            const groupBy = jest.fn();
            const db = {
                getClient: () => ({ workScheduleEntry: { groupBy } }),
            } as unknown as DatabaseService;
            const repository = new ServiceCalculationDataRepository(db);

            const result = await repository.findHoursWorkedForEmployees(
                [],
                '2026-08',
            );

            expect(result).toEqual(new Map());
            expect(groupBy).not.toHaveBeenCalled();
        });

        it('один groupBy на весь отдел — сотрудник без рабочих смен не попадает в карту', async () => {
            const groupBy = jest.fn().mockResolvedValue([
                { employeeId: 1, _sum: { hours: 16 } },
                { employeeId: 2, _sum: { hours: 8 } },
            ]);
            const db = {
                getClient: () => ({ workScheduleEntry: { groupBy } }),
            } as unknown as DatabaseService;
            const repository = new ServiceCalculationDataRepository(db);

            const result = await repository.findHoursWorkedForEmployees(
                [1, 2, 3],
                '2026-08',
            );

            expect(groupBy).toHaveBeenCalledTimes(1);
            expect(groupBy).toHaveBeenCalledWith({
                by: ['employeeId'],
                where: {
                    employeeId: { in: [1, 2, 3] },
                    status: 'WORKING',
                    date: {
                        gte: new Date(Date.UTC(2026, 7, 1)),
                        lte: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)),
                    },
                },
                _sum: { hours: true },
            });
            expect(result).toEqual(
                new Map([
                    [1, 16],
                    [2, 8],
                ]),
            );
            expect(result.has(3)).toBe(false);
        });
    });
});
