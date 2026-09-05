import type { Server } from 'http';
import { Module, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { RoleResponse } from 'ireports-contracts';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { SessionService } from '@/modules/session/infrastructure/session.service';
import { PermissionsGuard } from '../permissions.guard';
import { RolesCommandHandlers } from '../../application/command/roles-command-handlers.service';
import { RolesQueryHandlers } from '../../application/services/roles-query-handlers.service';
import { Role } from '../../domain/entities/role.entity';
import { ListRolesHttpController } from './list-roles.http.controller';
import { CreateRoleHttpController } from './create-role.http.controller';
import { RenameRoleHttpController } from './rename-role.http.controller';
import { DeleteRoleHttpController } from './delete-role.http.controller';
import { ListPermissionsCatalogHttpController } from './list-permissions-catalog.http.controller';
import { UpdateRolePermissionsHttpController } from './update-role-permissions.http.controller';
import { AssignRoleToEmployeeHttpController } from './assign-role-to-employee.http.controller';
import { RevokeRoleFromEmployeeHttpController } from './revoke-role-from-employee.http.controller';

// e2e-тесты HTTP-слоя `roles` (раздел 12 tasks.md) — проверяют РЕАЛЬНЫЙ
// маршрут HTTP → SessionAuthGuard → PermissionsGuard → Controller →
// (фейковый) application-слой, а не переповторяют бизнес-логику
// RolesCommandHandlers/RolesQueryHandlers — та уже исчерпывающе покрыта
// юнит-тестами разделов 9-10 (roles-command-handlers.spec.ts,
// roles-query-handlers.spec.ts). Модуль собран ЛОКАЛЬНО (не через реальный
// RolesModule/AuthModule), чтобы не поднимать всю транзитивную цепочку
// зависимостей (BitrixModule → BitrixAuthModule → Prisma, RedisModule и
// т.д., требующую реальных внешних сервисов) ради проверки исключительно
// HTTP/guard-слоя — SessionService заменён фейком напрямую в DI (тот же
// класс, на который ссылается SessionAuthGuard), остальные guard'ы/декораторы
// используются как есть (без фейков) для честной проверки 401/403/200 через
// реальный HTTP-запрос.
describe('Roles HTTP (e2e)', () => {
    let app: INestApplication<Server>;

    const createRole = jest.fn();
    const renameRole = jest.fn();
    const deleteRoleCommand = jest.fn();
    const assignRoleToEmployee = jest.fn();
    const revokeRoleFromEmployee = jest.fn();
    const updateRolePermissions = jest.fn();
    const getPermissionsCatalog = jest.fn();
    const getRoles = jest.fn();

    const validateSessionAndTouch = jest.fn();

    const fakeCommandHandlers: Partial<RolesCommandHandlers> = {
        createRole,
        renameRole,
        deleteRole: deleteRoleCommand,
        assignRoleToEmployee,
        revokeRoleFromEmployee,
        updateRolePermissions,
    };
    const fakeQueryHandlers: Partial<RolesQueryHandlers> = {
        getPermissionsCatalog,
        getRoles,
    };
    const fakeSessionService: Partial<SessionService> = {
        validateSessionAndTouch,
    };

    // Локальный тестовый модуль — см. WHY выше.
    @Module({
        controllers: [
            ListRolesHttpController,
            CreateRoleHttpController,
            RenameRoleHttpController,
            DeleteRoleHttpController,
            ListPermissionsCatalogHttpController,
            UpdateRolePermissionsHttpController,
            AssignRoleToEmployeeHttpController,
            RevokeRoleFromEmployeeHttpController,
        ],
        providers: [
            { provide: RolesCommandHandlers, useValue: fakeCommandHandlers },
            { provide: RolesQueryHandlers, useValue: fakeQueryHandlers },
            { provide: SessionService, useValue: fakeSessionService },
            Reflector,
            SessionAuthGuard,
            CsrfGuard,
            PermissionsGuard,
        ],
    })
    class RolesTestModule {}

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [RolesTestModule],
        }).compile();

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
        jest.clearAllMocks();
    });

    const withRole = () =>
        withRequestContext(() =>
            Role.create({
                name: 'Оператор',
                permissionCodes: ['roles:view'],
            }),
        );

    // Все findById.mockResolvedValueOnce ниже дублируют {sessionId} →
    // {bitrixEmployeeId, permissions}, тем же способом, что и
    // SessionAuthGuard.validateSessionAndTouch в проде (Redis).
    const authHeader = (permissions: string[] = ['roles:manage']) => {
        validateSessionAndTouch.mockResolvedValueOnce({
            bitrixEmployeeId: 42,
            permissions,
        });
        return { Authorization: 'Bearer session-abc' };
    };

    // spec: roles#session-required-for-protected-routes — запрос без сессии
    // вовсе получает 401, обработчик роута не выполняется.
    it('GET /v1/roles без сессии — 401, обработчик не вызывается', async () => {
        await request(app.getHttpServer()).get('/v1/roles').expect(401);
        expect(getRoles).not.toHaveBeenCalled();
    });

    // spec: roles#permission-check-on-route — валидная сессия, но без
    // roles:manage — 403 (и на чтении, и на мутирующем эндпоинте).
    it('GET /v1/roles с валидной сессией, но без roles:manage — 403', async () => {
        await request(app.getHttpServer())
            .get('/v1/roles')
            .set(authHeader(['reports:view']))
            .expect(403);
        expect(getRoles).not.toHaveBeenCalled();
    });

    it('POST /v1/roles с валидной сессией, но без roles:manage — 403', async () => {
        await request(app.getHttpServer())
            .post('/v1/roles')
            .set(authHeader(['reports:view']))
            .send({ name: 'Новая роль' })
            .expect(403);
        expect(createRole).not.toHaveBeenCalled();
    });

    it('GET /v1/roles с roles:manage — 200, возвращает список ролей', async () => {
        const role = withRole();
        getRoles.mockResolvedValueOnce([role]);

        const response = await request(app.getHttpServer())
            .get('/v1/roles')
            .set(authHeader())
            .expect(200);

        const body = response.body as RoleResponse[];
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
            id: role.id,
            name: 'Оператор',
            isSystem: false,
            permissionCodes: ['roles:view'],
        });
    });

    it('GET /v1/roles/permissions с roles:manage — 200, отдаёт каталог как есть', async () => {
        getPermissionsCatalog.mockResolvedValueOnce([
            { code: 'roles:view', label: 'Просмотр ролей', group: 'Роли' },
        ]);

        const response = await request(app.getHttpServer())
            .get('/v1/roles/permissions')
            .set(authHeader())
            .expect(200);

        expect(response.body).toEqual([
            { code: 'roles:view', label: 'Просмотр ролей', group: 'Роли' },
        ]);
    });

    it('POST /v1/roles с roles:manage — 201, создаёт роль', async () => {
        const role = withRole();
        createRole.mockResolvedValueOnce(role);

        const response = await request(app.getHttpServer())
            .post('/v1/roles')
            .set(authHeader())
            .send({ name: 'Оператор', permissionCodes: ['roles:view'] })
            .expect(201);

        expect(createRole).toHaveBeenCalledWith('Оператор', ['roles:view']);
        expect((response.body as RoleResponse).id).toBe(role.id);
    });

    it('PATCH /v1/roles/:id с roles:manage — 200, переименовывает роль', async () => {
        const role = withRole();
        renameRole.mockResolvedValueOnce(role);

        await request(app.getHttpServer())
            .patch(`/v1/roles/${role.id}`)
            .set(authHeader())
            .send({ name: 'Старший оператор' })
            .expect(200);

        expect(renameRole).toHaveBeenCalledWith(role.id, 'Старший оператор');
    });

    it('DELETE /v1/roles/:id с roles:manage — 204, удаляет роль', async () => {
        const role = withRole();
        deleteRoleCommand.mockResolvedValueOnce(undefined);

        await request(app.getHttpServer())
            .delete(`/v1/roles/${role.id}`)
            .set(authHeader())
            .expect(204);

        expect(deleteRoleCommand).toHaveBeenCalledWith(role.id);
    });

    it('PATCH /v1/roles/:id/permissions с roles:manage — 200, обновляет права роли', async () => {
        const role = withRole();
        updateRolePermissions.mockResolvedValueOnce(role);

        await request(app.getHttpServer())
            .patch(`/v1/roles/${role.id}/permissions`)
            .set(authHeader())
            .send({ permissionCodes: ['roles:view', 'roles:manage'] })
            .expect(200);

        expect(updateRolePermissions).toHaveBeenCalledWith(role.id, [
            'roles:view',
            'roles:manage',
        ]);
    });

    it('POST /v1/roles/:id/employees/:employeeId с roles:manage — 204, назначает роль сотруднику', async () => {
        const role = withRole();
        assignRoleToEmployee.mockResolvedValueOnce(undefined);

        await request(app.getHttpServer())
            .post(`/v1/roles/${role.id}/employees/42`)
            .set(authHeader())
            .expect(204);

        expect(assignRoleToEmployee).toHaveBeenCalledWith(42, role.id);
    });

    it('DELETE /v1/roles/:id/employees/:employeeId с roles:manage — 204, снимает роль с сотрудника', async () => {
        const role = withRole();
        revokeRoleFromEmployee.mockResolvedValueOnce(undefined);

        await request(app.getHttpServer())
            .delete(`/v1/roles/${role.id}/employees/42`)
            .set(authHeader())
            .expect(204);

        expect(revokeRoleFromEmployee).toHaveBeenCalledWith(42, role.id);
    });

    // spec: session#reject-requests-without-valid-session — недействительный
    // session_id (не найден в Redis) тоже получает 401.
    it('запрос с невалидным session_id — 401', async () => {
        validateSessionAndTouch.mockResolvedValueOnce(null);

        await request(app.getHttpServer())
            .get('/v1/roles')
            .set({ Authorization: 'Bearer bad-session' })
            .expect(401);
    });
});
