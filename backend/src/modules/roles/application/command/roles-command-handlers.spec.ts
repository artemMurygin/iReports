import { withRequestContext } from '@/shared/testing/with-request-context';
import { RolesCommandHandlers } from './roles-command-handlers.service';
import { Role } from '../../domain/entities/role.entity';
import type { RoleRepositoryPort } from '../ports/role.repository.port';
import type { PermissionCatalogRepositoryPort } from '../ports/permission-catalog.port';
import type { PermissionCatalogEntry } from '../ports/permission-registry.port';
import type { SessionPort } from '@/modules/session/application/ports/session.port';
import type { PermissionsResolverAdapter } from '../../infrastructure/permissions-resolver.adapter';
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
        employeeIdsByRole?: Record<string, number[]>;
        permissionsByEmployee?: Record<number, string[]>;
    }) => {
        const roles = new Map((options?.roles ?? []).map((r) => [r.id, r]));
        const catalog = options?.catalog ?? CATALOG;
        const employeeIdsByRole = options?.employeeIdsByRole ?? {};
        const permissionsByEmployee = options?.permissionsByEmployee ?? {};

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
                async (roleId: string): Promise<number[]> =>
                    employeeIdsByRole[roleId] ?? [],
            ),
            hasAnyRole: jest.fn(async (): Promise<boolean> => false),
        };

        const catalogRepository: jest.Mocked<PermissionCatalogRepositoryPort> =
            {
                upsertMany: jest.fn(),
                findAll: jest.fn(async () => catalog),
                findManyByCodes: jest.fn(async (codes: string[]) =>
                    catalog.filter((entry) => codes.includes(entry.code)),
                ),
            };

        const sessionPort: jest.Mocked<SessionPort> = {
            createSession: jest.fn(),
            invalidateSession: jest.fn(),
            invalidateAllSessionsForEmployee: jest.fn(),
            refreshPermissionsForEmployee: jest.fn(),
        };

        const permissionsResolver = {
            resolvePermissions: jest.fn(
                async (bitrixEmployeeId: number): Promise<string[]> =>
                    permissionsByEmployee[bitrixEmployeeId] ?? [],
            ),
        } as unknown as jest.Mocked<PermissionsResolverAdapter>;

        const handlers = new RolesCommandHandlers(
            roleRepository,
            catalogRepository,
            sessionPort,
            permissionsResolver,
        );

        return {
            handlers,
            roleRepository,
            catalogRepository,
            sessionPort,
            permissionsResolver,
            roles,
        };
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

    // spec: roles#model-role-permission — назначение/снятие роли сотруднику
    // (EmployeeRole, many-to-many).
    describe('assignRoleToEmployee', () => {
        it('назначает роль сотруднику', async () => {
            const role = withRequestContext(() =>
                Role.create({ name: 'Оператор' }),
            );
            const { handlers, roleRepository } = createHandlers({
                roles: [role],
            });

            await withRequestContext(() =>
                handlers.assignRoleToEmployee(42, role.id),
            );

            expect(roleRepository.assignToEmployee).toHaveBeenCalledWith(
                42,
                role.id,
            );
        });

        it('бросает RoleNotFoundException при назначении несуществующей роли', async () => {
            const { handlers, roleRepository } = createHandlers();

            await expect(
                withRequestContext(() =>
                    handlers.assignRoleToEmployee(42, 'missing-id'),
                ),
            ).rejects.toThrow(RoleNotFoundException);
            expect(roleRepository.assignToEmployee).not.toHaveBeenCalled();
        });
    });

    describe('revokeRoleFromEmployee', () => {
        it('снимает роль с сотрудника', async () => {
            const role = withRequestContext(() =>
                Role.create({ name: 'Оператор' }),
            );
            const { handlers, roleRepository } = createHandlers({
                roles: [role],
            });

            await withRequestContext(() =>
                handlers.revokeRoleFromEmployee(42, role.id),
            );

            expect(roleRepository.revokeFromEmployee).toHaveBeenCalledWith(
                42,
                role.id,
            );
        });
    });

    // spec: roles#immediate-permission-changes — снятое право перестаёт
    // действовать без релогина: updateRolePermissions пересчитывает и
    // проталкивает permissions во все активные сессии сотрудников этой роли.
    describe('updateRolePermissions', () => {
        it('меняет набор permissions роли', async () => {
            const role = withRequestContext(() =>
                Role.create({ name: 'Оператор', permissionCodes: ['roles:view'] }),
            );
            const { handlers, roleRepository } = createHandlers({
                roles: [role],
            });

            const updated = await withRequestContext(() =>
                handlers.updateRolePermissions(role.id, ['roles:manage']),
            );

            expect(updated.permissionCodes).toEqual(['roles:manage']);
            expect(roleRepository.save).toHaveBeenCalledWith(role);
        });

        it('отклоняет permission-код, отсутствующий в каталоге', async () => {
            const role = withRequestContext(() => Role.create({ name: 'Оператор' }));
            const { handlers } = createHandlers({ roles: [role] });

            await expect(
                withRequestContext(() =>
                    handlers.updateRolePermissions(role.id, ['unknown:code']),
                ),
            ).rejects.toThrow(PermissionCodeNotInCatalogException);
        });

        it('бросает RoleNotFoundException для несуществующей роли', async () => {
            const { handlers } = createHandlers();

            await expect(
                withRequestContext(() =>
                    handlers.updateRolePermissions('missing-id', ['roles:view']),
                ),
            ).rejects.toThrow(RoleNotFoundException);
        });

        it('пересчитывает и проталкивает permissions во все активные сессии сотрудников этой роли (снятое право перестаёт действовать без релогина)', async () => {
            const role = withRequestContext(() =>
                Role.create({
                    name: 'Оператор',
                    permissionCodes: ['roles:view', 'roles:manage'],
                }),
            );
            const { handlers, sessionPort, permissionsResolver } =
                createHandlers({
                    roles: [role],
                    employeeIdsByRole: { [role.id]: [1, 2] },
                    permissionsByEmployee: {
                        1: ['roles:view'],
                        2: ['roles:view', 'reports:view'],
                    },
                });

            await withRequestContext(() =>
                handlers.updateRolePermissions(role.id, ['roles:view']),
            );

            expect(permissionsResolver.resolvePermissions).toHaveBeenCalledWith(1);
            expect(permissionsResolver.resolvePermissions).toHaveBeenCalledWith(2);
            expect(
                sessionPort.refreshPermissionsForEmployee,
            ).toHaveBeenCalledWith(1, ['roles:view']);
            expect(
                sessionPort.refreshPermissionsForEmployee,
            ).toHaveBeenCalledWith(2, ['roles:view', 'reports:view']);
        });

        it('не трогает сессии, если у роли нет ни одного сотрудника', async () => {
            const role = withRequestContext(() =>
                Role.create({ name: 'Оператор' }),
            );
            const { handlers, sessionPort } = createHandlers({
                roles: [role],
            });

            await withRequestContext(() =>
                handlers.updateRolePermissions(role.id, ['roles:view']),
            );

            expect(
                sessionPort.refreshPermissionsForEmployee,
            ).not.toHaveBeenCalled();
        });
    });
});
