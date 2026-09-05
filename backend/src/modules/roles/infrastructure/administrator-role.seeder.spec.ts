import { withRequestContext } from '@/shared/testing/with-request-context';
import { AdministratorRoleSeeder } from './administrator-role.seeder';
import { Role } from '../domain/entities/role.entity';
import type { RoleRepositoryPort } from '../application/ports/role.repository.port';
import type { PermissionCatalogRepositoryPort } from '../application/ports/permission-catalog.port';
import type { PermissionCatalogEntry } from '../application/ports/permission-registry.port';

// spec: roles (design.md, Decision 9 + Migration Plan шаг 3) — сид создаёт
// системную роль Administrator со ВСЕМИ правами текущего каталога
// Permission (используется bootstrap первого администратора, раздел 11
// tasks.md).
describe('AdministratorRoleSeeder', () => {
    const CATALOG: PermissionCatalogEntry[] = [
        { code: 'roles:view', label: 'Просмотр ролей', group: 'Роли' },
        { code: 'roles:manage', label: 'Управление ролями', group: 'Роли' },
    ];

    const createSeeder = (options?: {
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
            delete: jest.fn(),
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
            findEmployeeIdsByRoleId: jest.fn(),
            hasAnyRole: jest.fn(),
        };

        const catalogRepository: jest.Mocked<PermissionCatalogRepositoryPort> =
            {
                upsertMany: jest.fn(),
                findAll: jest.fn(async () => catalog),
                findManyByCodes: jest.fn(),
            };

        const seeder = new AdministratorRoleSeeder(
            roleRepository,
            catalogRepository,
        );

        return { seeder, roleRepository, catalogRepository, roles };
    };

    it('создаёт роль Administrator со всеми правами каталога, если её ещё нет', async () => {
        const { seeder, roleRepository } = createSeeder();

        await seeder.seed();

        expect(roleRepository.insert).toHaveBeenCalledTimes(1);
        const inserted = roleRepository.insert.mock.calls[0][0];
        expect(inserted.name).toBe('Administrator');
        expect(inserted.isSystem).toBe(true);
        expect([...inserted.permissionCodes].sort()).toEqual([
            'roles:manage',
            'roles:view',
        ]);
    });

    it('идемпотентно обновляет права уже существующей роли Administrator до полного текущего каталога', async () => {
        const existing = withRequestContext(() =>
            Role.create({
                name: 'Administrator',
                isSystem: true,
                permissionCodes: ['roles:view'],
            }),
        );
        const { seeder, roleRepository } = createSeeder({
            roles: [existing],
            catalog: [
                ...CATALOG,
                { code: 'directory:manage', label: 'Справочник', group: 'Справочник' },
            ],
        });

        await seeder.seed();

        expect(roleRepository.insert).not.toHaveBeenCalled();
        expect(roleRepository.save).toHaveBeenCalledWith(existing);
        expect([...existing.permissionCodes].sort()).toEqual([
            'directory:manage',
            'roles:manage',
            'roles:view',
        ]);
    });
});
