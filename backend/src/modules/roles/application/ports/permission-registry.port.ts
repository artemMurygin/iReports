// Типизированный реестр permission-кодов, объявляемый КАЖДЫМ
// модулем-владельцем в своём файле `<module>.permissions.ts` (design.md,
// Decision 12) — например `src/modules/roles/roles.permissions.ts`. Не
// строка "resource:action" напрямую — TypeScript ловит опечатку в
// @RequirePermissions(...) на этапе компиляции, если он ссылается на
// PERMISSIONS.ROLES_MANAGE.code, а не на голую строку.
export interface PermissionCatalogEntry {
    code: string;
    label: string;
    group: string;
}

// DI-токен объединённого списка реестров (по одному массиву на модуль-
// владелец) — см. RolesModule providers, `useValue: [ROLES_PERMISSIONS, ...]`.
// PermissionsCatalogSeeder получает массив массивов и делает `.flat()`.
export const PERMISSION_REGISTRY = Symbol('PERMISSION_REGISTRY');
