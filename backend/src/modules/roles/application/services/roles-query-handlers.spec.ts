import { withRequestContext } from '@/shared/testing/with-request-context';
import { RolesQueryHandlers } from './roles-query-handlers.service';
import { Role } from '../../domain/entities/role.entity';
import type { RoleRepositoryPort } from '../ports/role.repository.port';
import type { PermissionCatalogRepositoryPort } from '../ports/permission-catalog.port';
import type { PermissionCatalogEntry } from '../ports/permission-registry.port';

// spec: roles#permission-catalog-from-code — каталог permission-кодов
// наполняется ТОЛЬКО PermissionsCatalogSeeder, читается как есть, без
// возможности создать новый код через этот (или любой другой) API.
describe('RolesQueryHandlers', () => {
    const createHandlers = (roles: Role[] = []) => {
        const findAll = jest.fn(() => Promise.resolve(roles));
        const findAllAssignments = jest.fn<
            ReturnType<RoleRepositoryPort['findAllAssignments']>,
            []
        >();
        const roleRepository: jest.Mocked<RoleRepositoryPort> = {
            insert: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByName: jest.fn(),
            findAll,
            assignToEmployee: jest.fn(),
            revokeFromEmployee: jest.fn(),
            findEmployeeIdsByRoleId: jest.fn(),
            hasAnyRole: jest.fn(),
            findAllAssignments,
        };
        return { roleRepository, findAll, findAllAssignments };
    };

    it('getPermissionsCatalog() возвращает каталог Permission как есть', async () => {
        const catalog: PermissionCatalogEntry[] = [
            { code: 'roles:view', label: 'Просмотр ролей', group: 'Роли' },
            { code: 'roles:manage', label: 'Управление ролями', group: 'Роли' },
        ];
        const findAll = jest.fn(() => Promise.resolve(catalog));
        const catalogRepository: jest.Mocked<PermissionCatalogRepositoryPort> =
            {
                upsertMany: jest.fn(),
                findAll,
                findManyByCodes: jest.fn(),
            };
        const { roleRepository } = createHandlers();

        const handlers = new RolesQueryHandlers(
            catalogRepository,
            roleRepository,
        );

        await expect(handlers.getPermissionsCatalog()).resolves.toEqual(
            catalog,
        );
        expect(findAll).toHaveBeenCalled();
    });

    it('не предоставляет метода создания нового permission-кода', () => {
        // Единственный писатель каталога — PermissionsCatalogSeeder
        // (design.md, Decision 12); RolesQueryHandlers — read-only.
        expect(
            (RolesQueryHandlers.prototype as unknown as Record<string, unknown>)
                .createPermission,
        ).toBeUndefined();
    });

    // spec: roles#model-role-permission — список ролей для списка/CRUD на
    // админ-странице (GET /roles).
    describe('getRoles', () => {
        it('возвращает все роли как есть, без изменений', async () => {
            const role = withRequestContext(() =>
                Role.create({ name: 'Оператор', permissionCodes: [] }),
            );
            const catalogRepository: jest.Mocked<PermissionCatalogRepositoryPort> =
                {
                    upsertMany: jest.fn(),
                    findAll: jest.fn(),
                    findManyByCodes: jest.fn(),
                };
            const { roleRepository, findAll } = createHandlers([role]);

            const handlers = new RolesQueryHandlers(
                catalogRepository,
                roleRepository,
            );

            await expect(handlers.getRoles()).resolves.toEqual([role]);
            expect(findAll).toHaveBeenCalled();
        });
    });

    // spec: roles#model-role-permission — назначения роль<->сотрудник
    // (EmployeeRole) для таблицы «Сотрудники» на админ-странице ролей
    // (раздел 22 tasks.md).
    describe('getRoleAssignments', () => {
        it('возвращает назначения роль<->сотрудник как есть, из репозитория', async () => {
            const catalogRepository: jest.Mocked<PermissionCatalogRepositoryPort> =
                {
                    upsertMany: jest.fn(),
                    findAll: jest.fn(),
                    findManyByCodes: jest.fn(),
                };
            const { roleRepository, findAllAssignments } = createHandlers();
            findAllAssignments.mockResolvedValueOnce([
                { bitrixEmployeeId: 42, roleIds: ['role-1', 'role-2'] },
                { bitrixEmployeeId: 43, roleIds: ['role-1'] },
            ]);

            const handlers = new RolesQueryHandlers(
                catalogRepository,
                roleRepository,
            );

            await expect(handlers.getRoleAssignments()).resolves.toEqual([
                { bitrixEmployeeId: 42, roleIds: ['role-1', 'role-2'] },
                { bitrixEmployeeId: 43, roleIds: ['role-1'] },
            ]);
            expect(findAllAssignments).toHaveBeenCalled();
        });
    });
});
