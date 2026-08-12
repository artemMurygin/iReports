import type { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    EmployeeIdentityResponse,
    UnmatchedEmployeeResponse,
} from 'ireports-contracts';
import { EmployeeIdentityModule } from '@/modules/employee-identity/employee-identity.module';
import { EMPLOYEE_IDENTITY_REPOSITORY } from '@/modules/employee-identity/application/ports/employee-identity.port';
import type {
    BitrixEmployeeSummary,
    EmployeeIdentityRepositoryPort,
} from '@/modules/employee-identity/application/ports/employee-identity.port';
import { EmployeeIdentity } from '@/modules/employee-identity/domain/entities/employee-identity.entity';
import { BitrixPortalAdminCheckService } from '@/integrations/bitrix/auth/portal-admin-check.service';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Как и get-employee-salary-report.e2e.spec.ts (см. соседний accounting-модуль):
// поднимает EmployeeIdentityModule целиком через Nest TestingModule (реальные
// Controller → CommandBus/Service → Handler → Entity → Guard), подменяя
// только границы с внешним миром — репозиторий и проверку admin в Bitrix24.
describe('EmployeeIdentity HTTP (e2e)', () => {
    let app: INestApplication<Server>;

    const store = new Map<string, EmployeeIdentity>();
    const seedEmployees: BitrixEmployeeSummary[] = [
        { id: 42, firstName: 'Иван', lastName: 'Иванов', departmentId: 1 },
        { id: 7, firstName: 'Пётр', lastName: 'Петров', departmentId: 1 },
    ];

    const fakeRepo: EmployeeIdentityRepositoryPort = {
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
        findByEmployee: (bitrixEmployeeId) =>
            Promise.resolve(
                [...store.values()].filter(
                    (i) => i.bitrixEmployeeId === bitrixEmployeeId,
                ),
            ),
        findByExternalId: (system, identifierType, externalId) =>
            Promise.resolve(
                [...store.values()].find(
                    (i) =>
                        i.system === system &&
                        i.identifierType === identifierType &&
                        i.externalId === externalId,
                ) ?? null,
            ),
        findUnmatchedEmployees: () => {
            const linked = new Set(
                [...store.values()].map((i) => i.bitrixEmployeeId),
            );
            return Promise.resolve(
                seedEmployees.filter((e) => !linked.has(e.id)),
            );
        },
    };

    // Только один пользователь в тесте — администратор портала; остальные
    // токены (включая руководителя) не проходят проверку.
    const fakeAdminCheck: Pick<BitrixPortalAdminCheckService, 'isPortalAdmin'> =
        {
            isPortalAdmin: (token: string) =>
                Promise.resolve(token === 'admin-token'),
        };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [EmployeeIdentityModule],
        })
            .overrideProvider(EMPLOYEE_IDENTITY_REPOSITORY)
            .useValue(fakeRepo)
            .overrideProvider(BitrixPortalAdminCheckService)
            .useValue(fakeAdminCheck)
            .compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(
                req as never,
                res as never,
                next,
            ),
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

    it('отклоняет запрос без токена текущего пользователя (403)', async () => {
        await request(app.getHttpServer())
            .post('/v1/employee-identity')
            .send({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            })
            .expect(403);
    });

    it('отклоняет руководителя, не являющегося администратором портала (403)', async () => {
        await request(app.getHttpServer())
            .post('/v1/employee-identity')
            .set('x-bitrix-auth', 'manager-token')
            .send({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            })
            .expect(403);
    });

    it('администратор портала выполняет полный CRUD связей', async () => {
        const createResponse = await request(app.getHttpServer())
            .post('/v1/employee-identity')
            .set('x-bitrix-auth', 'admin-token')
            .send({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            })
            .expect(201);
        const created = createResponse.body as EmployeeIdentityResponse;
        expect(created).toMatchObject({
            bitrixEmployeeId: 42,
            system: 'ROAPP',
            identifierType: 'EMPLOYEE_ID',
            externalId: '412',
        });

        // Второй идентификатор тому же сотруднику в той же системе —
        // допустимо (см. сценарий PRD "несколько идентификаторов в одной системе").
        await request(app.getHttpServer())
            .post('/v1/employee-identity')
            .set('x-bitrix-auth', 'admin-token')
            .send({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'ONLINE_MANAGER_FIELD',
                externalId: 'Иванов И.И.',
            })
            .expect(201);

        const listResponse = await request(app.getHttpServer())
            .get('/v1/employee-identity/employee/42')
            .set('x-bitrix-auth', 'admin-token')
            .expect(200);
        expect(listResponse.body).toHaveLength(2);

        const updateResponse = await request(app.getHttpServer())
            .patch(`/v1/employee-identity/${created.id}`)
            .set('x-bitrix-auth', 'admin-token')
            .send({ externalId: '999' })
            .expect(200);
        expect(
            (updateResponse.body as EmployeeIdentityResponse).externalId,
        ).toBe('999');

        await request(app.getHttpServer())
            .delete(`/v1/employee-identity/${created.id}`)
            .set('x-bitrix-auth', 'admin-token')
            .expect(204);

        const afterDelete = await request(app.getHttpServer())
            .get('/v1/employee-identity/employee/42')
            .set('x-bitrix-auth', 'admin-token')
            .expect(200);
        expect(afterDelete.body).toHaveLength(1);
    });

    it('отклоняет дубль идентификатора в той же системе (409)', async () => {
        withRequestContext(() => {
            const identity = EmployeeIdentity.create({
                bitrixEmployeeId: 7,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            });
            store.set(identity.id, identity);
        });

        await request(app.getHttpServer())
            .post('/v1/employee-identity')
            .set('x-bitrix-auth', 'admin-token')
            .send({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            })
            .expect(409);
    });

    it('возвращает список сотрудников без единой связи', async () => {
        withRequestContext(() => {
            const identity = EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            });
            store.set(identity.id, identity);
        });

        const response = await request(app.getHttpServer())
            .get('/v1/employee-identity/unmatched')
            .set('x-bitrix-auth', 'admin-token')
            .expect(200);

        const body = response.body as UnmatchedEmployeeResponse[];
        expect(body).toEqual([
            expect.objectContaining({ id: 7, lastName: 'Петров' }),
        ]);
    });

    it('список несопоставленных сотрудников тоже закрыт гардом (403 без токена)', async () => {
        await request(app.getHttpServer())
            .get('/v1/employee-identity/unmatched')
            .expect(403);
    });
});
