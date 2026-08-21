import type { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    MonthlyWorkScheduleResponse,
    WorkScheduleEntryResponse,
    WorkScheduleShiftResponse,
} from 'ireports-contracts';
import { WorkScheduleModule } from '@/modules/work-schedule/work-schedule.module';
import { WORK_SCHEDULE_ENTRY_REPOSITORY } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import type { WorkScheduleEntryRepositoryPort } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WorkDay } from '@/modules/work-schedule/domain/value-objects/work-day.value-object';
import { ANNUAL_VACATION_DAYS_LIMIT } from '@/modules/work-schedule/domain/constants/annual-vacation-limit';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Как и directory.e2e.spec.ts/employee-identity.e2e.spec.ts: поднимает
// WorkScheduleModule целиком через Nest TestingModule (реальные Controller →
// CommandBus/Service → Handler/Entity/VO), подменяя только границу с БД
// фейковыми репозиториями на уровне DI-токенов (WORK_SCHEDULE_ENTRY_REPOSITORY
// и, для GET /v1/work-schedule Фазы 3, DIRECTORY_REPOSITORY — модуль
// импортирует DirectoryModule ради списка сотрудников отдела).
describe('WorkSchedule HTTP (e2e)', () => {
    let app: INestApplication<Server>;

    const store = new Map<string, WorkScheduleEntry>();

    const fakeRepo: WorkScheduleEntryRepositoryPort = {
        insert: (entity) => {
            store.set(entity.id, entity);
            return Promise.resolve();
        },
        update: (entity) => {
            store.set(entity.id, entity);
            return Promise.resolve();
        },
        delete: (id) => {
            store.delete(id);
            return Promise.resolve();
        },
        findById: (id) => Promise.resolve(store.get(id) ?? null),
        findByEmployeeAndDate: (employeeId, date) =>
            Promise.resolve(
                [...store.values()].find(
                    (entry) =>
                        entry.employeeId === employeeId &&
                        entry.date.getValue() === date,
                ) ?? null,
            ),
        findByEmployeeIdsAndDateRange: (employeeIds, from, to) =>
            Promise.resolve(
                [...store.values()].filter(
                    (entry) =>
                        employeeIds.includes(entry.employeeId) &&
                        entry.date.toDate().getTime() >= from.getTime() &&
                        entry.date.toDate().getTime() <= to.getTime(),
                ),
            ),
    };

    // Сотрудники в трёх отделах: 1 и 2 — тот же набор, что и в
    // directory.e2e.spec.ts (для GET /v1/work-schedule?departmentId=,
    // Фаза 3); отдел 3 — три сотрудника отдельно для GET
    // /v1/work-schedule/shift (Фаза 4), чтобы проверять «на смене»/«не на
    // смене» на группе, не задевая ассерты Фазы 3 по отделам 1/2 (там
    // ожидается ровно по одному сотруднику).
    const fakeDirectory: DirectoryRepositoryPort = {
        findDepartments: () =>
            Promise.resolve([
                { id: 1, name: 'Сервис' },
                { id: 2, name: 'Магазин' },
                { id: 3, name: 'Смена' },
            ]),
        findEmployees: (departmentId) =>
            Promise.resolve(
                [
                    {
                        id: 42,
                        firstName: 'Иван',
                        lastName: 'Иванов',
                        departmentId: 1,
                    },
                    {
                        id: 7,
                        firstName: 'Пётр',
                        lastName: 'Петров',
                        departmentId: 2,
                    },
                    {
                        id: 101,
                        firstName: 'Анна',
                        lastName: 'Сидорова',
                        departmentId: 3,
                    },
                    {
                        id: 102,
                        firstName: 'Ольга',
                        lastName: 'Кузнецова',
                        departmentId: 3,
                    },
                    {
                        id: 103,
                        firstName: 'Сергей',
                        lastName: 'Смирнов',
                        departmentId: 3,
                    },
                ].filter(
                    (employee) =>
                        departmentId === undefined ||
                        employee.departmentId === departmentId,
                ),
            ),
    };

    // Период всегда OPEN — блокировку закрытым периодом (Ensure-
    // PeriodNotClosedService, тот же приём, что и у AccountingModule/
    // ShopAccountingModule) проверяет отдельный юнит-тест хендлеров, не
    // этот e2e.
    const fakeAccountingPeriodRepo: AccountingPeriodRepositoryPort = {
        findByDirectionAndPeriod: () => Promise.resolve(null),
        save: () => Promise.resolve(),
    };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [WorkScheduleModule],
        })
            .overrideProvider(WORK_SCHEDULE_ENTRY_REPOSITORY)
            .useValue(fakeRepo)
            .overrideProvider(DIRECTORY_REPOSITORY)
            .useValue(fakeDirectory)
            .overrideProvider(ACCOUNTING_PERIOD_REPOSITORY)
            .useValue(fakeAccountingPeriodRepo)
            .compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req, res, next),
        );
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        store.clear();
    });

    it('PUT создаёт запись дня и повторный PUT на ту же пару правит её, а не создаёт вторую', async () => {
        const createResponse = await request(app.getHttpServer())
            .put('/v1/work-schedule/entries')
            .send({
                employeeId: 42,
                date: '2026-08-05',
                status: 'WORKING',
                hours: 8,
                role: 'ENGINEER',
            })
            .expect(200);
        const created = createResponse.body as WorkScheduleEntryResponse;
        expect(created).toMatchObject({
            employeeId: 42,
            date: '2026-08-05',
            status: 'WORKING',
            hours: 8,
            role: 'ENGINEER',
        });
        expect(store.size).toBe(1);

        const secondResponse = await request(app.getHttpServer())
            .put('/v1/work-schedule/entries')
            .send({
                employeeId: 42,
                date: '2026-08-05',
                status: 'VACATION',
            })
            .expect(200);
        const updated = secondResponse.body as WorkScheduleEntryResponse;

        // Тот же id и по-прежнему одна запись — upsert правит, а не
        // добавляет вторую строку на ту же пару (сотрудник, дата).
        expect(updated.id).toBe(created.id);
        expect(updated.status).toBe('VACATION');
        expect(updated.hours).toBeNull();
        expect(updated.role).toBeNull();
        expect(store.size).toBe(1);
    });

    it('PUT отклоняет часы вне диапазона 2–16 с 400', async () => {
        await request(app.getHttpServer())
            .put('/v1/work-schedule/entries')
            .send({
                employeeId: 42,
                date: '2026-08-05',
                status: 'WORKING',
                hours: 20,
            })
            .expect(400);
        expect(store.size).toBe(0);
    });

    it('PUT отклоняет часы, не кратные 0,5, с 400', async () => {
        await request(app.getHttpServer())
            .put('/v1/work-schedule/entries')
            .send({
                employeeId: 42,
                date: '2026-08-05',
                status: 'WORKING',
                hours: 8.3,
            })
            .expect(400);
        expect(store.size).toBe(0);
    });

    it('PUT отклоняет часы, переданные с не-WORKING статусом, с 400', async () => {
        await request(app.getHttpServer())
            .put('/v1/work-schedule/entries')
            .send({
                employeeId: 42,
                date: '2026-08-05',
                status: 'DAY_OFF',
                hours: 8,
            })
            .expect(400);
        expect(store.size).toBe(0);
    });

    it('PUT отклоняет роль, переданную с не-WORKING статусом, с 400', async () => {
        await request(app.getHttpServer())
            .put('/v1/work-schedule/entries')
            .send({
                employeeId: 42,
                date: '2026-08-05',
                status: 'SICK_LEAVE',
                role: 'ENGINEER',
            })
            .expect(400);
        expect(store.size).toBe(0);
    });

    it('DELETE возвращает день в состояние «не заполнен»', async () => {
        const entry = withRequestContext(() =>
            WorkScheduleEntry.create({
                employeeId: 42,
                date: ScheduleDate.create('2026-08-05'),
                day: WorkDay.create({ status: 'WORKING', hours: 8 }),
            }),
        );
        store.set(entry.id, entry);

        await request(app.getHttpServer())
            .delete(`/v1/work-schedule/entries/${entry.id}`)
            .expect(204);

        expect(store.has(entry.id)).toBe(false);
    });

    it('DELETE несуществующей записи отклоняется с 404', async () => {
        await request(app.getHttpServer())
            .delete('/v1/work-schedule/entries/missing-id')
            .expect(404);
    });

    it('GET /v1/work-schedule — месяц с данными: 31 ячейка, заполненный день и корректные итоги/агрегаты', async () => {
        await request(app.getHttpServer())
            .put('/v1/work-schedule/entries')
            .send({
                employeeId: 42,
                date: '2026-08-05',
                status: 'WORKING',
                hours: 8,
                role: 'ENGINEER',
            })
            .expect(200);

        const response = await request(app.getHttpServer())
            .get('/v1/work-schedule')
            .query({ month: '2026-08', departmentId: 1 })
            .expect(200);
        const body = response.body as MonthlyWorkScheduleResponse;

        expect(body.month).toBe('2026-08');
        expect(body.departmentId).toBe(1);
        expect(body.employees).toHaveLength(1);
        const [row] = body.employees;
        expect(row.employeeId).toBe(42);
        expect(row.name).toBe('Иван Иванов');
        expect(row.days).toHaveLength(31);
        // 5-е августа — индекс 4.
        expect(row.days[4]).toMatchObject({
            date: '2026-08-05',
            status: 'WORKING',
            hours: 8,
            role: 'ENGINEER',
        });
        expect(row.totalHours).toBe(8);
        expect(row.vacationDaysUsed).toBe(0);
        expect(row.vacationDaysLimit).toBe(ANNUAL_VACATION_DAYS_LIMIT);

        const dayAggregate = body.days.find((d) => d.date === '2026-08-05');
        expect(dayAggregate?.peopleOnShift).toBe(1);
        expect(body.totalHours).toBe(8);
    });

    it('GET /v1/work-schedule — месяц без единой записи отдаёт пустые ячейки и нули, а не ошибку', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/work-schedule')
            .query({ month: '2026-09', departmentId: 1 })
            .expect(200);
        const body = response.body as MonthlyWorkScheduleResponse;

        expect(body.employees).toHaveLength(1);
        const [row] = body.employees;
        expect(row.days).toHaveLength(30);
        expect(row.days.every((day) => day.status === null)).toBe(true);
        expect(row.totalHours).toBe(0);
        expect(row.vacationDaysUsed).toBe(0);
        expect(body.days.every((day) => day.peopleOnShift === 0)).toBe(true);
        expect(body.totalHours).toBe(0);
    });

    it('GET /v1/work-schedule?departmentId= — фильтрует сотрудников по отделу', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/work-schedule')
            .query({ month: '2026-08', departmentId: 2 })
            .expect(200);
        const body = response.body as MonthlyWorkScheduleResponse;

        expect(body.employees).toHaveLength(1);
        expect(body.employees[0].employeeId).toBe(7);
    });

    it('GET /v1/work-schedule без month отклоняется с 400', async () => {
        await request(app.getHttpServer()).get('/v1/work-schedule').expect(400);
    });

    it('GET /v1/work-schedule/shift — на смене, не на смене по причинам, счётчики ролей и суммарные часы', async () => {
        // 101 — на смене; 102 — выходной; 103 — без записи на дату
        // («не заполнен», см. PRD, критерий готовности Фазы 4).
        await request(app.getHttpServer())
            .put('/v1/work-schedule/entries')
            .send({
                employeeId: 101,
                date: '2026-08-05',
                status: 'WORKING',
                hours: 8,
                role: 'ENGINEER',
            })
            .expect(200);
        await request(app.getHttpServer())
            .put('/v1/work-schedule/entries')
            .send({
                employeeId: 102,
                date: '2026-08-05',
                status: 'DAY_OFF',
            })
            .expect(200);

        const response = await request(app.getHttpServer())
            .get('/v1/work-schedule/shift')
            .query({ date: '2026-08-05', departmentId: 3 })
            .expect(200);
        const body = response.body as WorkScheduleShiftResponse;

        expect(body.date).toBe('2026-08-05');
        expect(body.departmentId).toBe(3);
        expect(body.onShift).toEqual([
            {
                employeeId: 101,
                name: 'Анна Сидорова',
                role: 'ENGINEER',
                hours: 8,
            },
        ]);
        expect(body.notOnShift).toEqual([
            {
                reason: 'DAY_OFF',
                employees: [{ employeeId: 102, name: 'Ольга Кузнецова' }],
            },
            {
                reason: 'NOT_FILLED',
                employees: [{ employeeId: 103, name: 'Сергей Смирнов' }],
            },
        ]);
        expect(body.roleCounts).toEqual([{ role: 'ENGINEER', count: 1 }]);
        expect(body.totalHours).toBe(8);

        // Сумма «на смене» + «не на смене» равна числу сотрудников отдела
        // (см. PRD, критерий готовности Фазы 4).
        const notOnShiftCount = body.notOnShift.reduce(
            (sum, group) => sum + group.employees.length,
            0,
        );
        expect(body.onShift.length + notOnShiftCount).toBe(3);

        // Счётчики ролей сходятся со списком «на смене».
        const rolesInList = body.onShift
            .filter((employee) => employee.role !== null)
            .map((employee) => employee.role);
        const rolesInCounts = body.roleCounts.reduce(
            (sum, roleCount) => sum + roleCount.count,
            0,
        );
        expect(rolesInCounts).toBe(rolesInList.length);
    });

    it('GET /v1/work-schedule/shift — дата без единой записи отдаёт всех сотрудников как «не заполнен»', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/work-schedule/shift')
            .query({ date: '2026-09-01', departmentId: 3 })
            .expect(200);
        const body = response.body as WorkScheduleShiftResponse;

        expect(body.onShift).toEqual([]);
        expect(body.notOnShift).toEqual([
            {
                reason: 'NOT_FILLED',
                employees: [
                    { employeeId: 101, name: 'Анна Сидорова' },
                    { employeeId: 102, name: 'Ольга Кузнецова' },
                    { employeeId: 103, name: 'Сергей Смирнов' },
                ],
            },
        ]);
        expect(body.roleCounts).toEqual([]);
        expect(body.totalHours).toBe(0);
    });

    it('GET /v1/work-schedule/shift без date отклоняется с 400', async () => {
        await request(app.getHttpServer())
            .get('/v1/work-schedule/shift')
            .query({ departmentId: 3 })
            .expect(400);
    });
});
