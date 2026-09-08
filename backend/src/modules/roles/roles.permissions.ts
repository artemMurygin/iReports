import type { PermissionCatalogEntry } from './application/ports/permission-registry.port';

// Типизированный реестр permission-кодов модуля roles (design.md,
// Decision 12) — единственное место, откуда `roles:*` попадают в каталог
// (PermissionsCatalogSeeder). `roles:manage` — единственное право,
// назначаемое системной роли Administrator при bootstrap (раздел 11
// tasks.md, design.md Decision 9) вместе со всем остальным каталогом.
export const ROLES_PERMISSIONS: PermissionCatalogEntry[] = [
    {
        code: 'roles:view',
        label: 'Просмотр ролей и прав',
        group: 'Роли и права',
    },
    {
        code: 'roles:manage',
        label: 'Управление ролями и правами',
        group: 'Роли и права',
    },
];
