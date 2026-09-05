import { withRequestContext } from '@/shared/testing/with-request-context';
import { RolesCommandHandlers } from './roles-command-handlers.service';
import { Role } from '../../domain/entities/role.entity';
import type { RoleRepositoryPort } from '../ports/role.repository.port';
import type { PermissionCatalogRepositoryPort } from '../ports/permission-catalog.port';
import type { PermissionCatalogEntry } from '../ports/permission-registry.port';
import {
    PermissionCodeNotInCatalogException,
    RoleNameAlreadyExistsException,
    RoleNotFoundException,
    SystemRoleCannotBeDeletedException,
} from '../../domain/exceptions/role.exception';

// spec: roles#model-role-permission (CRUD ролей) /
// roles#permission-catalog-from-code (нельзя сослаться на несуществующий
// код каталога ни при создании, ни при назначении прав).
describe('RolesCommandHandlers', () => {
    const CATALOG: PermissionCatalogEntry[] = [
        { code: 'roles:view', label: 'Просмотр ролей', group: 'Роли' },
        { code: 'roles:manage', label: 'Управление ролями', group: 'Роли' },
    ];

    const createHandlers = (options?: {
        roles?: Role[];
        catalog?: PermissionCatalogEntry[];
    }) => {
        const roles = new Map((options?.roles ?? []).map((r) => [r.id, r]));
        const catalog = options?.catalog ?? CATALOG;

        const roleRepository: jest.Mocked<RoleRepositoryPort> = {
            insert: jest.fn(async (role: Role) => {
                roles.set(role.id, role);
            }),
            save: jest.fn(async (role: Role) => {
                roles.set(role.id, role);
            }),
            delete: jest.fn(async (id: string) => {
                roles.delete(id);
            }),
            findById: jest.fn(async (id: string) => roles.get(id) ?? null),
            findByName: jest.fn(async (name: string) => {
                for (const role of roles.values()) {
                    if (role.name === name) return role;
                }
                return null;
            }),
            findAll: jest.fn(async () => [...roles.values()]),
            assignToEmployee: jest.fn(),
            revokeFromEmployee: jest.fn(),
            findEmployeeIdsByRoleId: jest.fn(
                async (_roleId: string): Promise<number[]> => [],
            ),
        };

        const catalogRepository: jest.Mocked<PermissionCatalogRepositoryPort> =
            {
                upsertMany: jest.fn(),
                findAll: jest.fn(async () => catalog),
                findManyByCodes: jest.fn(async (codes: string[]) =>
                    catalog.filter((entry) => codes.includes(entry.code)),
                ),
            };

        const handlers = new RolesCommandHandlers(
            roleRepository,
            catalogRepository,
        );

        return { handlers, roleRepository, catalogRepository, roles };
    };

    describe('createRole', () => {
        it('создаёт роль без permissions', async () => {
            const { handlers, roleRepository } = createHandlers();

            const role = await withRequestContext(() =>
                handlers.createRole('Оператор'),
            );

            expect(role.name).toBe('Оператор');
            expect(roleRepository.insert).toHaveBeenCalledWith(role);
        });

        it('создаёт роль сразу с набором permissions ИЗ каталога', async () => {
            const { handlers } = createHandlers();

            const role = await withRequestContext(() =>
                handlers.createRole('Администратор', [
                    'roles:view',
                    'roles:manage',
                ]),
            );

            expect([...role.permissionCodes].sort()).toEqual([
                'roles:manage',
                'roles:view',
            ]);
        });

        it('отклоняет создание роли с именем, которое уже занято', async () => {
            const existing = withRequestContext(() =>
                Role.create({ name: 'Оператор' }),
            );
            const { handlers } = createHandlers({ roles: [existing] });

            await expect(
                withRequestContext(() => handlers.createRole('Оператор')),
            ).rejects.toThrow(RoleNameAlreadyExistsException);
        });

        it('отклоняет создание роли с permission-кодом, которого нет в каталоге', async () => {
            const { handlers } = createHandlers();

            await expect(
                withRequestContext(() =>
                    handlers.createRole('Оператор', ['reports:delete-all']),
                ),
            ).rejects.toThrow(PermissionCodeNotInCatalogException);
        });
    });

    describe('renameRole', () => {
        it('переименовывает существующую роль', async () => {
            const existing = withRequestContext(() =>
                Role.create({ name: 'Оператор' }),
            );
            const { handlers, roleRepository } = createHandlers({
                roles: [existing],
            });

            const renamed = await withRequestContext(() =>
                handlers.renameRole(existing.id, 'Старший оператор'),
            );

            expect(renamed.name).toBe('Старший оператор');
            expect(roleRepository.save).toHaveBeenCalledWith(existing);
        });

        it('отклоняет переименование в уже занятое имя другой роли', async () => {
            const roleA = withRequestContext(() => Role.create({ name: 'A' }));
            const roleB = withRequestContext(() => Role.create({ name: 'B' }));
            const { handlers } = createHandlers({ roles: [roleA, roleB] });

            await expect(
                withRequestContext(() => handlers.renameRole(roleA.id, 'B')),
            ).rejects.toThrow(RoleNameAlreadyExistsException);
        });

        it('позволяет "переименовать" роль в то же самое имя', async () => {
            const existing = withRequestContext(() =>
                Role.create({ name: 'Оператор' }),
            );
            const { handlers } = createHandlers({ roles: [existing] });

            await expect(
                withRequestContext(() =>
                    handlers.renameRole(existing.id, 'Оператор'),
                ),
            ).resolves.toBeDefined();
        });

        it('бросает RoleNotFoundException для несуществующей роли', async () => {
            const { handlers } = createHandlers();

            await expect(
                withRequestContext(() =>
                    handlers.renameRole('missing-id', 'Новое имя'),
                ),
            ).rejects.toThrow(RoleNotFoundException);
        });
    });

    describe('deleteRole', () => {
        it('удаляет обычную роль', async () => {
            const existing = withRequestContext(() =>
                Role.create({ name: 'Оператор' }),
            );
            const { handlers, roleRepository } = createHandlers({
                roles: [existing],
            });

            await withRequestContext(() => handlers.deleteRole(existing.id));

            expect(roleRepository.delete).toHaveBeenCalledWith(existing.id);
        });

        it('отклоняет удаление системной роли Administrator', async () => {
            const admin = withRequestContext(() =>
                Role.create({ name: 'Administrator', isSystem: true }),
            );
            const { handlers, roleRepository } = createHandlers({
                roles: [admin],
            });

            await expect(
                withRequestContext(() => handlers.deleteRole(admin.id)),
            ).rejects.toThrow(SystemRoleCannotBeDeletedException);
            expect(roleRepository.delete).not.toHaveBeenCalled();
        });

        it('бросает RoleNotFoundException для несуществующей роли', async () => {
            const { handlers } = createHandlers();

            await expect(
                withRequestContext(() => handlers.deleteRole('missing-id')),
            ).rejects.toThrow(RoleNotFoundException);
        });
    });
});
