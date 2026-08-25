import { ServiceCalculationDataRepository } from './service-calculation-data.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// findHoursWorked/findHoursWorkedForEmployees читают рабочие смены графика
// (WorkScheduleEntry.status = WORKING) с ролью дня ONLINE_MANAGER/
// OFFLINE_MANAGER/SOLO_MANAGER (см. domain/services/pay-per-hour-roles.ts) и
// делят их на
// факт (по `now` включительно) и прогноз (весь период) — вместо прежней
// одной Prisma `aggregate`/`_sum`, conditional-агрегация по двум диапазонам
// дат одним запросом Prisma без raw SQL недоступна, поэтому читаем строки
// (`findMany`) и суммируем в коде. Тот же приём мока DatabaseService, что и
// в moysklad-sales-fact-source.repository.spec.ts — PrismaRepository.client
// делегирует в db.getClient(), фейковому db достаточно реализовать только
// используемый метод.
describe('ServiceCalculationDataRepository — часы графика', () => {
    describe('findHoursWorked', () => {
        it('запрашивает WORKING-смены с ролью ONLINE_MANAGER/OFFLINE_MANAGER/SOLO_MANAGER в границах периода', async () => {
            const findMany = jest.fn().mockResolvedValue([]);
            const db = {
                getClient: () => ({
                    workScheduleEntry: { findMany },
                }),
            } as unknown as DatabaseService;
            const repository = new ServiceCalculationDataRepository(db);

            await repository.findHoursWorked(
                42,
                '2026-08',
                new Date('2026-08-15T12:00:00.000Z'),
            );

            expect(findMany).toHaveBeenCalledWith({
                where: {
                    employeeId: 42,
                    status: 'WORKING',
                    role: {
                        in: [
                            'ONLINE_MANAGER',
                            'OFFLINE_MANAGER',
                            'SOLO_MANAGER',
                        ],
                    },
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
                // День после `now` — считается только в прогноз.
                { date: new Date(Date.UTC(2026, 7, 20)), hours: 8 },
            ]);
            const db = {
                getClient: () => ({ workScheduleEntry: { findMany } }),
            } as unknown as DatabaseService;
            const repository = new ServiceCalculationDataRepository(db);

            const result = await repository.findHoursWorked(
                42,
                '2026-08',
                new Date('2026-08-15T12:00:00.000Z'),
            );

            expect(result).toEqual({ fact: 16, prognose: 24 });
        });

        it('`now` позже конца периода — факт равен прогнозу (весь месяц уже позади)', async () => {
            const findMany = jest.fn().mockResolvedValue([
                { date: new Date(Date.UTC(2026, 7, 1)), hours: 8 },
                { date: new Date(Date.UTC(2026, 7, 31)), hours: 8 },
            ]);
            const db = {
                getClient: () => ({ workScheduleEntry: { findMany } }),
            } as unknown as DatabaseService;
            const repository = new ServiceCalculationDataRepository(db);

            const result = await repository.findHoursWorked(
                42,
                '2026-08',
                new Date('2026-09-05T00:00:00.000Z'),
            );

            expect(result).toEqual({ fact: 16, prognose: 16 });
        });

        it('нет подходящих рабочих смен за период — возвращает { fact: 0, prognose: 0 }', async () => {
            const findMany = jest.fn().mockResolvedValue([]);
            const db = {
                getClient: () => ({ workScheduleEntry: { findMany } }),
            } as unknown as DatabaseService;
            const repository = new ServiceCalculationDataRepository(db);

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
            const repository = new ServiceCalculationDataRepository(db);

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
            const repository = new ServiceCalculationDataRepository(db);

            const result = await repository.findHoursWorkedForEmployees(
                [1, 2, 3],
                '2026-08',
                new Date('2026-08-15T00:00:00.000Z'),
            );

            expect(findMany).toHaveBeenCalledTimes(1);
            expect(findMany).toHaveBeenCalledWith({
                where: {
                    employeeId: { in: [1, 2, 3] },
                    status: 'WORKING',
                    role: {
                        in: [
                            'ONLINE_MANAGER',
                            'OFFLINE_MANAGER',
                            'SOLO_MANAGER',
                        ],
                    },
                    date: {
                        gte: new Date(Date.UTC(2026, 7, 1)),
                        lte: new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999)),
                    },
                },
                select: { employeeId: true, date: true, hours: true },
            });
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
