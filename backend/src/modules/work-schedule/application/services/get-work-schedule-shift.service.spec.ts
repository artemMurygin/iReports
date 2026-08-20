import { GetWorkScheduleShiftService } from './get-work-schedule-shift.service';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { WorkScheduleEntryRepositoryPort } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WorkDay } from '@/modules/work-schedule/domain/value-objects/work-day.value-object';

// Состав смены на дату (Фаза 4) — все зависимости чистые in-memory фейки,
// без NestJS DI и без БД, тем же приёмом, что и
// get-monthly-work-schedule.service.spec.ts (Фаза 3).
describe('GetWorkScheduleShiftService', () => {
    const buildEntry = (
        employeeId: number,
        date: string,
        status: 'WORKING' | 'DAY_OFF' | 'TIME_OFF' | 'SICK_LEAVE' | 'VACATION',
        hours?: number,
        role?: string,
    ) =>
        WorkScheduleEntry.create({
            employeeId,
            date: ScheduleDate.create(date),
            day: WorkDay.create({ status, hours, role }),
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

        const service = new GetWorkScheduleShiftService(directory, repo);
        return { service, findEmployees, findByEmployeeIdsAndDateRange };
    };

    it('распределяет сотрудников на «на смене» и «не на смене» по причинам', async () => {
        const employees = [
            { id: 1, firstName: 'Иван', lastName: 'Иванов', departmentId: 1 },
            { id: 2, firstName: 'Пётр', lastName: 'Петров', departmentId: 1 },
            {
                id: 3,
                firstName: 'Анна',
                lastName: 'Сидорова',
                departmentId: 1,
            },
            {
                id: 4,
                firstName: 'Ольга',
                lastName: 'Кузнецова',
                departmentId: 1,
            },
            {
                id: 5,
                firstName: 'Сергей',
                lastName: 'Смирнов',
                departmentId: 1,
            },
        ];
        const entries = [
            buildEntry(1, '2026-08-05', 'WORKING', 8, 'ENGINEER'),
            buildEntry(2, '2026-08-05', 'WORKING', 6, 'ONLINE_MANAGER'),
            buildEntry(3, '2026-08-05', 'DAY_OFF'),
            buildEntry(4, '2026-08-05', 'VACATION'),
            // Сотрудник 5 без записи на эту дату — «не заполнен».
        ];
        const { service } = buildService({ employees, entries });

        const result = await service.execute('2026-08-05', 1);

        expect(result.date).toBe('2026-08-05');
        expect(result.departmentId).toBe(1);
        expect(result.onShift).toHaveLength(2);
        expect(result.onShift).toEqual(
            expect.arrayContaining([
                {
                    employeeId: 1,
                    name: 'Иван Иванов',
                    role: 'ENGINEER',
                    hours: 8,
                },
                {
                    employeeId: 2,
                    name: 'Пётр Петров',
                    role: 'ONLINE_MANAGER',
                    hours: 6,
                },
            ]),
        );

        // «На смене» (2) + «не на смене» (3) = число сотрудников отдела (5).
        const notOnShiftCount = result.notOnShift.reduce(
            (sum, group) => sum + group.employees.length,
            0,
        );
        expect(result.onShift.length + notOnShiftCount).toBe(employees.length);

        expect(result.notOnShift).toEqual([
            {
                reason: 'DAY_OFF',
                employees: [{ employeeId: 3, name: 'Анна Сидорова' }],
            },
            {
                reason: 'VACATION',
                employees: [{ employeeId: 4, name: 'Ольга Кузнецова' }],
            },
            {
                reason: 'NOT_FILLED',
                employees: [{ employeeId: 5, name: 'Сергей Смирнов' }],
            },
        ]);
    });

    it('счётчики ролей сходятся со списком «на смене»', async () => {
        const employees = [
            { id: 1, firstName: 'Иван', lastName: 'Иванов', departmentId: 1 },
            { id: 2, firstName: 'Пётр', lastName: 'Петров', departmentId: 1 },
            {
                id: 3,
                firstName: 'Анна',
                lastName: 'Сидорова',
                departmentId: 1,
            },
        ];
        const entries = [
            buildEntry(1, '2026-08-05', 'WORKING', 8, 'ENGINEER'),
            buildEntry(2, '2026-08-05', 'WORKING', 8, 'ENGINEER'),
            buildEntry(3, '2026-08-05', 'WORKING', 4, 'OFFICE'),
        ];
        const { service } = buildService({ employees, entries });

        const result = await service.execute('2026-08-05', 1);

        expect(result.roleCounts).toEqual([
            { role: 'ENGINEER', count: 2 },
            { role: 'OFFICE', count: 1 },
        ]);
        expect(result.totalHours).toBe(20);
    });

    it('рабочий день без указанной роли не попадает в счётчики ролей', async () => {
        const employees = [
            { id: 1, firstName: 'Иван', lastName: 'Иванов', departmentId: 1 },
        ];
        const entries = [buildEntry(1, '2026-08-05', 'WORKING', 8)];
        const { service } = buildService({ employees, entries });

        const result = await service.execute('2026-08-05', 1);

        expect(result.onShift).toEqual([
            { employeeId: 1, name: 'Иван Иванов', role: null, hours: 8 },
        ]);
        expect(result.roleCounts).toEqual([]);
    });

    it('сотрудник без записи на дату попадает в «не на смене» с причиной NOT_FILLED', async () => {
        const employees = [
            { id: 1, firstName: 'Иван', lastName: 'Иванов', departmentId: 1 },
        ];
        const { service } = buildService({ employees, entries: [] });

        const result = await service.execute('2026-08-05', 1);

        expect(result.onShift).toEqual([]);
        expect(result.notOnShift).toEqual([
            {
                reason: 'NOT_FILLED',
                employees: [{ employeeId: 1, name: 'Иван Иванов' }],
            },
        ]);
        expect(result.totalHours).toBe(0);
    });

    it('пустые группы причин и роли без человек в смене не отдаются в ответе', async () => {
        const employees = [
            { id: 1, firstName: 'Иван', lastName: 'Иванов', departmentId: 1 },
        ];
        const entries = [buildEntry(1, '2026-08-05', 'WORKING', 8, 'ENGINEER')];
        const { service } = buildService({ employees, entries });

        const result = await service.execute('2026-08-05', 1);

        expect(result.notOnShift).toEqual([]);
        expect(result.roleCounts).toEqual([{ role: 'ENGINEER', count: 1 }]);
    });

    it('отдел без сотрудников не запрашивает записи графика и отдаёт пустой ответ', async () => {
        const { service, findByEmployeeIdsAndDateRange } = buildService({
            employees: [],
        });

        const result = await service.execute('2026-08-05', 99);

        expect(result.onShift).toEqual([]);
        expect(result.notOnShift).toEqual([]);
        expect(result.roleCounts).toEqual([]);
        expect(result.totalHours).toBe(0);
        expect(findByEmployeeIdsAndDateRange).not.toHaveBeenCalled();
    });

    it('departmentId не передан — фильтр в directory не задаётся, в ответе departmentId: null', async () => {
        const { service, findEmployees } = buildService({ employees: [] });

        const result = await service.execute('2026-08-05');

        expect(findEmployees).toHaveBeenCalledWith(undefined);
        expect(result.departmentId).toBeNull();
    });

    it('число запросов к портам фиксировано (по одному вызову) независимо от числа сотрудников', async () => {
        const employees = Array.from({ length: 13 }, (_, index) => ({
            id: index + 1,
            firstName: 'Сотрудник',
            lastName: `№${index + 1}`,
            departmentId: 1,
        }));
        const { service, findEmployees, findByEmployeeIdsAndDateRange } =
            buildService({ employees });

        await service.execute('2026-08-05', 1);

        expect(findEmployees).toHaveBeenCalledTimes(1);
        expect(findByEmployeeIdsAndDateRange).toHaveBeenCalledTimes(1);
    });
});
