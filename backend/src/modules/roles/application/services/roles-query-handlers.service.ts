import { Inject, Injectable } from '@nestjs/common';
import {
    PERMISSION_CATALOG_REPOSITORY,
    type PermissionCatalogRepositoryPort,
} from '../ports/permission-catalog.port';
import type { PermissionCatalogEntry } from '../ports/permission-registry.port';
import {
    ROLE_REPOSITORY,
    type RoleRepositoryPort,
} from '../ports/role.repository.port';
import { Role } from '../../domain/entities/role.entity';

// Читает каталог Permission, наполненный PermissionsCatalogSeeder из
// типизированных реестров модулей-владельцев (design.md, Decision 12) —
// источник строк матрицы "роль × permission" на админ-странице ролей
// (useRolePermissionsMatrix). Каталог НЕ редактируется через этот или любой
// другой API — единственный писатель в таблицу Permission — сам сидер.
//
// getRoles() (раздел 12 tasks.md) — список ролей для GET /roles (спек
// roles#model-role-permission); read-only, без побочных эффектов — команды
// изменения (create/rename/delete/updatePermissions) остаются в
// RolesCommandHandlers (CQRS-разделение).
@Injectable()
export class RolesQueryHandlers {
    constructor(
        @Inject(PERMISSION_CATALOG_REPOSITORY)
        private readonly catalogRepository: PermissionCatalogRepositoryPort,
        @Inject(ROLE_REPOSITORY)
        private readonly roleRepository: RoleRepositoryPort,
    ) {}

    async getPermissionsCatalog(): Promise<PermissionCatalogEntry[]> {
        return this.catalogRepository.findAll();
    }

    async getRoles(): Promise<Role[]> {
        return this.roleRepository.findAll();
    }

    // Назначения роль<->сотрудник (spec: roles#model-role-permission,
    // EmployeeRole many-to-many) — источник таблицы «Сотрудники» на
    // админ-странице ролей (раздел 22 tasks.md, GET /roles/assignments);
    // read-only, только сотрудники с хотя бы одной ролью.
    async getRoleAssignments(): Promise<
        { bitrixEmployeeId: number; roleIds: string[] }[]
    > {
        return this.roleRepository.findAllAssignments();
    }
}
