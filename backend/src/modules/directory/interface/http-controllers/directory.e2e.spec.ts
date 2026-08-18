import type { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import type { DepartmentResponse, EmployeeResponse } from 'ireports-contracts';
import { DirectoryModule } from '@/modules/directory/directory.module';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';

// Как и catalog.e2e.spec.ts (domains/shop/modules/warehouse) — поднимает
// DirectoryModule целиком через Nest TestingModule (реальные Controller →
// Service → мапперы), подменяя только границу с БД фейковым репозиторием
// на уровне DI-токена (тот же приём, что employee-identity.e2e.spec.ts).
// Без гарда — эндпоинты общедоступны, тот же принцип, что и у остальных
// внутренних справочников без модели прав (deals.managers,
// shop.warehouse.catalog).
describe('Directory HTTP (e2e)', () => {
    let app: INestApplication<Server>;

    const fakeRepo: DirectoryRepositoryPort = {
        findDepartments: () =>
            Promise.resolve([
                { id: 1, name: 'Сервис' },
                { id: 2, name: 'Магазин' },
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
                ].filter(
                    (employee) =>
                        departmentId === undefined ||
                        employee.departmentId === departmentId,
                ),
            ),
    };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [DirectoryModule],
        })
            .overrideProvider(DIRECTORY_REPOSITORY)
            .useValue(fakeRepo)
            .compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ZodValidationPipe());
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
});
