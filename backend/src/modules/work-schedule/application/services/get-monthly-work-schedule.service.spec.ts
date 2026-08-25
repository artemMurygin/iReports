import { GetMonthlyWorkScheduleService } from './get-monthly-work-schedule.service';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { WorkScheduleEntryRepositoryPort } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WorkDay } from '@/modules/work-schedule/domain/value-objects/work-day.value-object';
import { ANNUAL_VACATION_DAYS_LIMIT } from '@/modules/work-schedule/domain/constants/annual-vacation-limit';

// Агрегация месячного графика (Фаза 3) — все зависимости чистые in-memory
// фейки, без NestJS DI и без БД, тем же приёмом, что и
// get-department-salary-report.service.spec.ts.
describe('GetMonthlyWorkScheduleService', () => {
    const buildEntry = (
        employeeId: number,
        date: string,
        status: 'WORKING' | 'DAY_OFF' | 'TIME_OFF' | 'SICK_LEAVE' | 'VACATION',
        hours?: number,
        role?: string,
        isOnDuty?: boolean,
    ) =>
        WorkScheduleEntry.create({
            employeeId,
            date: ScheduleDate.create(date),
            day: WorkDay.create({ status, hours, role, isOnDuty }),
        });

    const buildService = (overrides: {
        employees?: {
            id: number;
            firstName: string;
            lastName: string;
            departmentId: number;
        }[];
        entries?: WorkScheduleEntry[];
    }) => {
        const findEmployees = jest
            .fn()
            .mockResolvedValue(overrides.employees ?? []);
        const directory: DirectoryRepositoryPort = {
            findDepartments: jest.fn().mockResolvedValue([]),
            findEmployees,
        };

        const findByEmployeeIdsAndDateRange = jest
            .fn()
            .mockResolvedValue(overrides.entries ?? []);
        const repo: WorkScheduleEntryRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByEmployeeAndDate: jest.fn(),
            findByEmployeeIdsAndDateRange,
        };

        const service = new GetMonthlyWorkScheduleService(directory, repo);
        return { service, findEmployees, findByEmployeeIdsAndDateRange };
    };

    it('возвращает 31 ячейку на сотрудника за август с корректными итогами', async () => {
        const employees = [
            { id: 42, firstName: 'Иван', lastName: 'Иванов', departmentId: 1 },
        ];
        const entries = [
            buildEntry(42, '2026-08-01', 'WORKING', 8, 'ENGINEER'),
            buildEntry(42, '2026-08-02', 'WORKING', 6.5, 'ENGINEER'),
            buildEntry(42, '2026-08-03', 'DAY_OFF'),
        ];
        const { service } = buildService({ employees, entries });

        const result = await service.execute('2026-08', 1);

        expect(result.month).toBe('2026-08');
        expect(result.departmentId).toBe(1);
        expect(result.employees).toHaveLength(1);
        const row = result.employees[0];
        expect(row.days).toHaveLength(31);
        expect(row.days[0]).toMatchObject({
            date: '2026-08-01',
            status: 'WORKING',
            hours: 8,
            role: 'ENGINEER',
        });
        expect(row.days[0].entryId).toEqual(expect.any(String));
        expect(row.days[1]).toMatchObject({
            date: '2026-08-02',
            status: 'WORKING',
            hours: 6.5,
        });
        expect(row.days[2]).toMatchObject({
            date: '2026-08-03',
            status: 'DAY_OFF',
            hours: null,
        });
        // День без записи — пустая ячейка, а не ошибка.
        expect(row.days[3]).toEqual({
            date: '2026-08-04',
            entryId: null,
            status: null,
            hours: null,
            role: null,
            isOnDuty: false,
        });
        expect(row.totalHours).toBe(14.5);
    });

    it('месяц без единой записи графика отдаёт пустые ячейки и нулевые итоги, а не ошибку', async () => {
        const employees = [
            { id: 42, firstName: 'Иван', lastName: 'Иванов', departmentId: 1 },
        ];
        const { service } = buildService({ employees, entries: [] });

        const result = await service.execute('2026-08', 1);

        expect(result.employees[0].days.every((d) => d.status === null)).toBe(
            true,
        );
        expect(result.employees[0].totalHours).toBe(0);
        expect(result.employees[0].vacationDaysUsed).toBe(0);
        expect(result.employees[0].vacationDaysLimit).toBe(
            ANNUAL_VACATION_DAYS_LIMIT,
        );
        expect(result.days.every((d) => d.peopleOnShift === 0)).toBe(true);
        expect(result.totalHours).toBe(0);
    });

    it('отдел без сотрудников не запрашивает записи графика и отдаёт пустой ответ', async () => {
        const { service, findByEmployeeIdsAndDateRange } = buildService({
            employees: [],
        });

        const result = await service.execute('2026-08', 99);

        expect(result.employees).toEqual([]);
        expect(result.days).toHaveLength(31);
        expect(result.days.every((d) => d.peopleOnShift === 0)).toBe(true);
        expect(findByEmployeeIdsAndDateRange).not.toHaveBeenCalled();
    });

    it('departmentId не передан — фильтр в directory не задаётся, в ответе departmentId: null', async () => {
        const { service, findEmployees } = buildService({ employees: [] });

        const result = await service.execute('2026-08');

        expect(findEmployees).toHaveBeenCalledWith(undefined);
        expect(result.departmentId).toBeNull();
    });

    it('«Человек в смене» и фонд часов дня агрегируются по всем сотрудникам', async () => {
        const employees = [
            { id: 1, firstName: 'Иван', lastName: 'Иванов', departmentId: 1 },
            { id: 2, firstName: 'Пётр', lastName: 'Петров', departmentId: 1 },
        ];
        const entries = [
            buildEntry(1, '2026-08-05', 'WORKING', 8),
            buildEntry(2, '2026-08-05', 'WORKING', 4),
            buildEntry(2, '2026-08-06', 'VACATION'),
        ];
        const { service } = buildService({ employees, entries });

        const result = await service.execute('2026-08', 1);

        const day5 = result.days.find((d) => d.date === '2026-08-05');
        expect(day5?.peopleOnShift).toBe(2);
        const day6 = result.days.find((d) => d.date === '2026-08-06');
        expect(day6?.peopleOnShift).toBe(0);
        // Общий фонд часов месяца — сумма часов обоих сотрудников за 5-е.
        expect(result.totalHours).toBe(12);
    });

    it('суммирует часы нескольких смен за месяц без потери дробной части', async () => {
        const employees = [
            { id: 1, firstName: 'Иван', lastName: 'Иванов', departmentId: 1 },
        ];
        const entries = [
            buildEntry(1, '2026-08-01', 'WORKING', 8.5),
            buildEntry(1, '2026-08-02', 'WORKING', 7.5),
            buildEntry(1, '2026-08-03', 'WORKING', 6.5),
        ];
        const { service } = buildService({ employees, entries });

        const result = await service.execute('2026-08', 1);

        expect(result.employees[0].totalHours).toBe(22.5);
        expect(result.totalHours).toBe(22.5);
    });

    it('использованные дни отпуска считаются за весь год месяца, включая дни вне отображаемого месяца', async () => {
        const employees = [
            { id: 1, firstName: 'Иван', lastName: 'Иванов', departmentId: 1 },
        ];
        const entries = [
            buildEntry(1, '2026-03-10', 'VACATION'),
            buildEntry(1, '2026-08-15', 'VACATION'),
            buildEntry(1, '2026-08-16', 'VACATION'),
        ];
        const { service } = buildService({ employees, entries });

        const result = await service.execute('2026-08', 1);

        expect(result.employees[0].vacationDaysUsed).toBe(3);
    });

    it('запрашивает записи графика границами календарного года месяца', async () => {
        const employees = [
            { id: 1, firstName: 'Иван', lastName: 'Иванов', departmentId: 1 },
        ];
        const { service, findByEmployeeIdsAndDateRange } = buildService({
            employees,
        });

        await service.execute('2026-08', 1);

        expect(findByEmployeeIdsAndDateRange).toHaveBeenCalledWith(
            [1],
            new Date(Date.UTC(2026, 0, 1)),
            new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999)),
        );
    });

    it('isOnDuty ячейки отражает отметку дежурства записи, а не заполнена по умолчанию у всех остальных дней', async () => {
        const employees = [
            { id: 1, firstName: 'Иван', lastName: 'Иванов', departmentId: 1 },
            { id: 2, firstName: 'Пётр', lastName: 'Петров', departmentId: 1 },
        ];
        const entries = [
            buildEntry(1, '2026-08-05', 'WORKING', 8, 'ENGINEER', true),
            buildEntry(1, '2026-08-06', 'WORKING', 8),
            buildEntry(2, '2026-08-05', 'WORKING', 8),
        ];
        const { service } = buildService({ employees, entries });

        const result = await service.execute('2026-08', 1);

        const [employee1, employee2] = result.employees;
        const duty = employee1.days.find((d) => d.date === '2026-08-05');
        expect(duty?.isOnDuty).toBe(true);

        const restOfEmployee1Days = employee1.days.filter(
            (d) => d.date !== '2026-08-05',
        );
        expect(restOfEmployee1Days.every((d) => d.isOnDuty === false)).toBe(
            true,
        );
        expect(employee2.days.every((d) => d.isOnDuty === false)).toBe(true);
    });

    it('число запросов к порту фиксировано (по одному вызову) независимо от числа сотрудников — без N+1', async () => {
        const employees = Array.from({ length: 13 }, (_, index) => ({
            id: index + 1,
            firstName: `Сотрудник`,
            lastName: `№${index + 1}`,
            departmentId: 1,
        }));
        const { service, findEmployees, findByEmployeeIdsAndDateRange } =
            buildService({ employees });

        const result = await service.execute('2026-08', 1);

        expect(result.employees).toHaveLength(13);
        expect(findEmployees).toHaveBeenCalledTimes(1);
        expect(findByEmployeeIdsAndDateRange).toHaveBeenCalledTimes(1);
    });
});
