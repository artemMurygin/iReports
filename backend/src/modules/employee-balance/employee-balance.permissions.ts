import type { PermissionCatalogEntry } from '@/modules/roles/application/ports/permission-registry.port';

// Типизированный реестр permission-кодов модуля employee-balance — тот же
// паттерн, что ROLES_PERMISSIONS/TASKS_PERMISSIONS (design.md roles,
// Decision 12). Баланс сквозной (не разбит по direction), поэтому один
// набор кодов на оба домена, а не service-/shop- префикс, как у accounting.
//
// view_own/view_department в каталоге есть, но не проверяются ни одним
// guard'ом — ни один из контроллеров сейчас не сравнивает request.user с
// запрошенным :id/отделом (тот же приём и то же ограничение, что
// tasks:view_own в tasks.permissions.ts). Реальный гейт GET-эндпоинтов —
// view_all.
export const EMPLOYEE_BALANCE_PERMISSIONS: PermissionCatalogEntry[] = [
    {
        code: 'employee-balance:view_own',
        label: 'Просмотр своего баланса',
        group: 'Баланс сотрудника',
    },
    {
        code: 'employee-balance:view_department',
        label: 'Просмотр баланса своего отдела',
        group: 'Баланс сотрудника',
    },
    {
        code: 'employee-balance:view_all',
        label: 'Просмотр баланса любого сотрудника',
        group: 'Баланс сотрудника',
    },
    {
        code: 'employee-balance:edit',
        label: 'Ручные движения баланса (создание и удаление)',
        group: 'Баланс сотрудника',
    },
];
