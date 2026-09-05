import { Module } from '@nestjs/common';
import { PERMISSION_REGISTRY } from './application/ports/permission-registry.port';
import { PERMISSION_CATALOG_REPOSITORY } from './application/ports/permission-catalog.port';
import { PERMISSIONS_RESOLVER_PORT } from './application/ports/permissions-resolver.port';
import { PermissionCatalogRepository } from './infrastructure/repositories/permission-catalog.repository';
import { PermissionsCatalogSeeder } from './infrastructure/permissions-catalog.seeder';
import { PermissionsResolverAdapter } from './infrastructure/permissions-resolver.adapter';
import { PermissionsGuard } from './interface/permissions.guard';
import { ROLES_PERMISSIONS } from './roles.permissions';

// Сквозной модуль ролей/прав (add-bitrix24-auth-and-rbac) — владеет
// Role/Permission, guard'ами (PermissionsGuard), админ-API (design.md,
// Decision 1). Живёт вне domains/{service,shop}, по аналогии с
// src/modules/employee-identity. Наполняется по мере прохождения
// tasks.md (разделы 9, 10, 11 добавят CRUD ролей/назначение).
@Module({
    providers: [
        PermissionsCatalogSeeder,
        {
            provide: PERMISSION_CATALOG_REPOSITORY,
            useClass: PermissionCatalogRepository,
        },
        // NestJS не агрегирует провайдеры одного токена из разных модулей
        // сам по себе (в отличие от APP_GUARD/APP_INTERCEPTOR — это
        // хардкод фреймворка именно под них) — поэтому объединённый список
        // реестров собирается явно здесь, простым TS-импортом каждого
        // `<module>.permissions.ts`. Новый модуль-владелец добавляет свой
        // реестр в этот массив одной строкой — явное изменение кода,
        // видимое на ревью (design.md, Decision 12), а не рантайм-магия.
        {
            provide: PERMISSION_REGISTRY,
            useValue: [ROLES_PERMISSIONS],
        },
        PermissionsResolverAdapter,
        {
            provide: PERMISSIONS_RESOLVER_PORT,
            useExisting: PermissionsResolverAdapter,
        },
        PermissionsGuard,
    ],
    exports: [
        PermissionsCatalogSeeder,
        PERMISSION_CATALOG_REPOSITORY,
        PERMISSIONS_RESOLVER_PORT,
        PermissionsGuard,
    ],
})
export class RolesModule {}
