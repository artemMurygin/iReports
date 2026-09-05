import { Inject, Injectable } from '@nestjs/common';
import {
    PERMISSION_CATALOG_REPOSITORY,
    type PermissionCatalogRepositoryPort,
} from '../ports/permission-catalog.port';
import type { PermissionCatalogEntry } from '../ports/permission-registry.port';

// Читает каталог Permission, наполненный PermissionsCatalogSeeder из
// типизированных реестров модулей-владельцев (design.md, Decision 12) —
// источник строк матрицы "роль × permission" на админ-странице ролей
// (useRolePermissionsMatrix). Каталог НЕ редактируется через этот или любой
// другой API — единственный писатель в таблицу Permission — сам сидер.
@Injectable()
export class RolesQueryHandlers {
    constructor(
        @Inject(PERMISSION_CATALOG_REPOSITORY)
        private readonly catalogRepository: PermissionCatalogRepositoryPort,
    ) {}

    async getPermissionsCatalog(): Promise<PermissionCatalogEntry[]> {
        return this.catalogRepository.findAll();
    }
}
