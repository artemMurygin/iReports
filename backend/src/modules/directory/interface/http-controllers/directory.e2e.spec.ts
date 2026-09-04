import type { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    DepartmentResponse,
    EmployeeResponse,
    ListEmployeesWithServiceAccountResponse,
    SetEmployeeServiceAccountResponse,
} from 'ireports-contracts';
import { DirectoryModule } from '@/modules/directory/directory.module';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { DomainExceptionFilter } from '@/shared/exceptions';

// Как и catalog.e2e.spec.ts (domains/shop/modules/warehouse) — поднимает
// DirectoryModule целиком через Nest TestingModule (реальные Controller →
// Service → мапперы), подменяя только границу с БД фейковым репозиторием
// на уровне DI-токена (тот же приём, что employee-identity.e2e.spec.ts).
// Без гарда — эндпоинты общедоступны, тот же принцип, что и у остальных
// внутренних справочников без модели прав (deals.managers,
// shop.warehouse.catalog).
describe('Directory HTTP (e2e)', () => {
    let app: INestApplication<Server>;

    // Стейтфул: order хранится в фейке (как в реальном BitrixEmployee.order,
    // docs/employee-ordering-and-salary-filter, Фаза 1), findEmployees
    // сортирует по нему — так PATCH .../employees/order ниже можно
    // проверить именно через повторный GET, а не через шпион на аргументах
    // вызова.
    const employees: {
        id: number;
        firstName: string;
        lastName: string;
        departmentId: number;
        order: number;
        isServiceAccount: boolean;
    }[] = [
        {
            id: 42,
            firstName: 'Иван',
            lastName: 'Иванов',
            departmentId: 1,
            order: 0,
            isServiceAccount: false,
        },
        {
            id: 7,
            firstName: 'Пётр',
            lastName: 'Петров',
            departmentId: 2,
            order: 1,
            isServiceAccount: false,
        },
    ];

    const fakeRepo: DirectoryRepositoryPort = {
        findDepartments: () =>
            Promise.resolve([
                { id: 1, name: 'Сервис' },
                { id: 2, name: 'Магазин' },
            ]),
        // includeServiceAccounts: true (Фаза 3) обходит фильтр
        // isServiceAccount — тот же приём, что у реального
        // DirectoryRepository.findEmployees (см. WHY в directory.port.ts).
        findEmployees: (departmentId, options) =>
            Promise.resolve(
                [...employees]
                    .sort((a, b) => a.order - b.order)
                    .filter(
                        (employee) =>
                            departmentId === undefined ||
                            employee.departmentId === departmentId,
                    )
                    .filter(
                        (employee) =>
                            options?.includeServiceAccounts ||
                            !employee.isServiceAccount,
                    )
                    .map(
                        ({
                            id,
                            firstName,
                            lastName,
                            departmentId,
                            isServiceAccount,
                        }) => ({
                            id,
                            firstName,
                            lastName,
                            departmentId,
                            // Нужен GET .../employees/service-accounts (Фаза 4)
                            // — сам справочник GET .../employees его
                            // игнорирует (EmployeeResponse его не содержит).
                            isServiceAccount,
                        }),
                    ),
            ),
        updateEmployeesOrder: (items) => {
            for (const item of items) {
                const employee = employees.find(
                    (e) => e.id === item.employeeId,
                );
                if (employee) {
                    employee.order = item.order;
                }
            }
            return Promise.resolve();
        },
        // Стейтфул, как order выше (docs/employee-ordering-and-salary-filter,
        // Фаза 3) — PATCH .../employees/:id/service-account ниже проверяется
        // через повторный GET /v1/directory/employees, а не только шпионом
        // на аргументах вызова.
        findServiceAccountEmployeeIds: () =>
            Promise.resolve(
                new Set(
                    employees
                        .filter((e) => e.isServiceAccount)
                        .map((e) => e.id),
                ),
            ),
        setServiceAccount: (employeeId, isServiceAccount) => {
            const employee = employees.find((e) => e.id === employeeId);
            if (!employee) {
                return Promise.resolve(null);
            }
            employee.isServiceAccount = isServiceAccount;
            const { id, firstName, lastName, departmentId } = employee;
            return Promise.resolve({
                id,
                firstName,
                lastName,
                departmentId,
                isServiceAccount,
            });
        },
    };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [DirectoryModule],
        })
            .overrideProvider(DIRECTORY_REPOSITORY)
            .useValue(fakeRepo)
            .compile();

        app = moduleRef.createNestApplication();
        // Обязательно для PATCH .../employees/order — ReorderEmployeesCommand
        // (см. shared/domain/command.base.ts) читает RequestContext в
        // конструкторе, который в проде открывает этот middleware на каждый
        // запрос (см. app.module.ts); без него — TypeError (тот же приём,
        // что и в work-schedule.e2e.spec.ts).
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req, res, next),
        );
        app.useGlobalPipes(new ZodValidationPipe());
        // EmployeeNotFoundException/ArgumentInvalidException (Фаза 3,
        // PATCH .../employees/:id/service-account) — без фильтра долетают
        // до клиента как 500, а не 404/400 (тот же приём, что и в
        // work-schedule.e2e.spec.ts).
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('GET /v1/directory/departments — отдаёт непустой список с id/name', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/directory/departments')
            .expect(200);

        const body = response.body as DepartmentResponse[];
        expect(body.length).toBeGreaterThan(0);
        expect(body).toEqual([
            { id: 1, name: 'Сервис' },
            { id: 2, name: 'Магазин' },
        ]);
    });

    it('GET /v1/directory/employees — без фильтра отдаёт сотрудников всех отделов с id/name/departmentId', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/directory/employees')
            .expect(200);

        const body = response.body as EmployeeResponse[];
        expect(body.length).toBeGreaterThan(0);
        expect(body).toEqual([
            { id: 42, name: 'Иван Иванов', departmentId: 1 },
            { id: 7, name: 'Пётр Петров', departmentId: 2 },
        ]);
    });

    it('GET /v1/directory/employees?departmentId= — фильтрует сотрудников по отделу', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/directory/employees')
            .query({ departmentId: 2 })
            .expect(200);

        const body = response.body as EmployeeResponse[];
        expect(body).toEqual([{ id: 7, name: 'Пётр Петров', departmentId: 2 }]);
    });

    // Тесты ниже мутируют общий фейк (employees) — намеренно идут после
    // тестов выше, порядок которых зависит от исходного order (42 раньше
    // 7), чтобы не ломать их (docs/employee-ordering-and-salary-filter,
    // Фаза 1, "unit-тест на reorder-эндпоинт (сохранение и повторное чтение
    // порядка)").
    it('PATCH /v1/directory/employees/order — сохраняет новый порядок и сразу отдаёт его в ответе', async () => {
        const response = await request(app.getHttpServer())
            .patch('/v1/directory/employees/order')
            .send({
                items: [
                    { employeeId: 7, order: 0 },
                    { employeeId: 42, order: 1 },
                ],
            })
            .expect(200);

        const body = response.body as EmployeeResponse[];
        expect(body).toEqual([
            { id: 7, name: 'Пётр Петров', departmentId: 2 },
            { id: 42, name: 'Иван Иванов', departmentId: 1 },
        ]);
    });

    it('GET /v1/directory/employees — после PATCH .../order отдаёт тот же новый порядок при повторном чтении', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/directory/employees')
            .expect(200);

        const body = response.body as EmployeeResponse[];
        expect(body).toEqual([
            { id: 7, name: 'Пётр Петров', departmentId: 2 },
            { id: 42, name: 'Иван Иванов', departmentId: 1 },
        ]);
    });

    it('PATCH /v1/directory/employees/order — без items (пустой массив) отклоняется валидацией', async () => {
        await request(app.getHttpServer())
            .patch('/v1/directory/employees/order')
            .send({ items: [] })
            .expect(400);
    });

    // Тесты ниже (Фаза 3, docs/employee-ordering-and-salary-filter) идут
    // последними по той же причине, что и блок reorder выше — мутируют
    // общий фейк (employees[42].isServiceAccount).
    it('PATCH /v1/directory/employees/:id/service-account — включает признак и сразу отдаёт его в ответе', async () => {
        const response = await request(app.getHttpServer())
            .patch('/v1/directory/employees/42/service-account')
            .send({ isServiceAccount: true })
            .expect(200);

        const body = response.body as SetEmployeeServiceAccountResponse;
        expect(body).toEqual({
            id: 42,
            name: 'Иван Иванов',
            departmentId: 1,
            isServiceAccount: true,
        });
    });

    it('GET /v1/directory/employees — сотрудник с isServiceAccount: true исключён из справочника', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/directory/employees')
            .expect(200);

        const body = response.body as EmployeeResponse[];
        expect(body).toEqual([{ id: 7, name: 'Пётр Петров', departmentId: 2 }]);
    });

    // Фаза 4 (docs/employee-ordering-and-salary-filter) — GET .../employees/
    // service-accounts НЕ фильтрует isServiceAccount: true (в отличие от
    // обычного справочника выше) и отдаёт сам признак — питает страницу
    // настроек и страницу «Связи сотрудников» (обе обязаны продолжать видеть
    // служебные аккаунты).
    it('GET /v1/directory/employees/service-accounts — не исключает служебный аккаунт и отдаёт isServiceAccount', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/directory/employees/service-accounts')
            .expect(200);

        const body = response.body as ListEmployeesWithServiceAccountResponse;
        expect(body).toEqual([
            { id: 7, name: 'Пётр Петров', departmentId: 2, isServiceAccount: false },
            { id: 42, name: 'Иван Иванов', departmentId: 1, isServiceAccount: true },
        ]);
    });

    it('PATCH /v1/directory/employees/:id/service-account — снятие признака возвращает сотрудника в справочник', async () => {
        await request(app.getHttpServer())
            .patch('/v1/directory/employees/42/service-account')
            .send({ isServiceAccount: false })
            .expect(200);

        const response = await request(app.getHttpServer())
            .get('/v1/directory/employees')
            .expect(200);

        const body = response.body as EmployeeResponse[];
        expect(body.map((e) => e.id).sort((a, b) => a - b)).toEqual([7, 42]);
    });

    it('GET /v1/directory/employees/service-accounts — после снятия признака отдаёт isServiceAccount: false', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/directory/employees/service-accounts')
            .expect(200);

        const body = response.body as ListEmployeesWithServiceAccountResponse;
        expect(body.find((e) => e.id === 42)).toEqual({
            id: 42,
            name: 'Иван Иванов',
            departmentId: 1,
            isServiceAccount: false,
        });
    });

    it('PATCH /v1/directory/employees/:id/service-account — несуществующий сотрудник отклоняется 404', async () => {
        await request(app.getHttpServer())
            .patch('/v1/directory/employees/999999/service-account')
            .send({ isServiceAccount: true })
            .expect(404);
    });

    it('PATCH /v1/directory/employees/:id/service-account — нечисловой id отклоняется 400', async () => {
        await request(app.getHttpServer())
            .patch('/v1/directory/employees/abc/service-account')
            .send({ isServiceAccount: true })
            .expect(400);
    });

    it('PATCH /v1/directory/employees/:id/service-account — isServiceAccount не булево отклоняется валидацией', async () => {
        await request(app.getHttpServer())
            .patch('/v1/directory/employees/42/service-account')
            .send({ isServiceAccount: 'yes' })
            .expect(400);
    });
});
