import { Inject, Injectable } from '@nestjs/common';
import { Role } from '../domain/entities/role.entity';
import {
    ROLE_REPOSITORY,
    type RoleRepositoryPort,
} from '../application/ports/role.repository.port';
import {
    PERMISSION_CATALOG_REPOSITORY,
    type PermissionCatalogRepositoryPort,
} from '../application/ports/permission-catalog.port';
import { ADMINISTRATOR_ROLE_NAME } from '../application/services/bootstrap-admin-role-assigner.service';

// Сидирует системную роль Administrator со ВСЕМИ правами текущего каталога
// Permission (design.md, Decision 9 + Migration Plan шаг 3) — используется
// bootstrap первого администратора (BootstrapAdminRoleAssigner, раздел 11
// tasks.md). Запускается ПОСЛЕ PermissionsCatalogSeeder тем же деплойным
// скриптом (npm run seed:permissions), не при каждом старте приложения.
// Идемпотентно: повторный запуск обновляет права уже существующей роли до
// полного ТЕКУЩЕГО каталога (в т.ч. новые permission-коды, добавленные
// позже другими модулями-владельцами), не создаёт дублей.
@Injectable()
export class AdministratorRoleSeeder {
    constructor(
        @Inject(ROLE_REPOSITORY)
        private readonly roleRepository: RoleRepositoryPort,
        @Inject(PERMISSION_CATALOG_REPOSITORY)
        private readonly catalogRepository: PermissionCatalogRepositoryPort,
    ) {}

    async seed(): Promise<void> {
        const catalog = await this.catalogRepository.findAll();
        const codes = catalog.map((entry) => entry.code);

        const existing = await this.roleRepository.findByName(
            ADMINISTRATOR_ROLE_NAME,
        );

        if (existing) {
            existing.updatePermissions(codes);
            await this.roleRepository.save(existing);
            return;
        }

        const role = Role.create({
            name: ADMINISTRATOR_ROLE_NAME,
            isSystem: true,
            permissionCodes: codes,
        });
        await this.roleRepository.insert(role);
    }
}
