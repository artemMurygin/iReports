import { RolesQueryHandlers } from './roles-query-handlers.service';
import type { PermissionCatalogRepositoryPort } from '../ports/permission-catalog.port';
import type { PermissionCatalogEntry } from '../ports/permission-registry.port';

// spec: roles#permission-catalog-from-code — каталог permission-кодов
// наполняется ТОЛЬКО PermissionsCatalogSeeder, читается как есть, без
// возможности создать новый код через этот (или любой другой) API.
describe('RolesQueryHandlers', () => {
    it('getPermissionsCatalog() возвращает каталог Permission как есть', async () => {
        const catalog: PermissionCatalogEntry[] = [
            { code: 'roles:view', label: 'Просмотр ролей', group: 'Роли' },
            { code: 'roles:manage', label: 'Управление ролями', group: 'Роли' },
        ];
        const catalogRepository: jest.Mocked<PermissionCatalogRepositoryPort> =
            {
                upsertMany: jest.fn(),
                findAll: jest.fn(async () => catalog),
                findManyByCodes: jest.fn(),
            };

        const handlers = new RolesQueryHandlers(catalogRepository);

        await expect(handlers.getPermissionsCatalog()).resolves.toEqual(
            catalog,
        );
        expect(catalogRepository.findAll).toHaveBeenCalled();
    });

    it('не предоставляет метода создания нового permission-кода', () => {
        // Единственный писатель каталога — PermissionsCatalogSeeder
        // (design.md, Decision 12); RolesQueryHandlers — read-only.
        expect(
            (RolesQueryHandlers.prototype as unknown as Record<string, unknown>)
                .createPermission,
        ).toBeUndefined();
    });
});
