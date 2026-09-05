import type { PermissionCatalogEntry } from './application/ports/permission-registry.port';

// Типизированный реестр permission-кодов модуля roles (design.md,
// Decision 12) — единственное место, откуда `roles:*` попадают в каталог
// (PermissionsCatalogSeeder). Наполняется по мере прохождения tasks.md
// (раздел 9 добавляет roles:view/roles:manage вместе с CRUD ролей).
export const ROLES_PERMISSIONS: PermissionCatalogEntry[] = [];
