import type { PermissionCatalogEntry } from '@/modules/roles/application/ports/permission-registry.port';

// Типизированный реестр permission-кодов модуля employee-balance — тот же
// паттерн, что ROLES_PERMISSIONS/TASKS_PERMISSIONS (design.md roles,
// Decision 12). Баланс сквозной (не разбит по direction), поэтому один
// набор кодов на оба домена, а не service-/shop- префикс, как у accounting.
//
// view_own проверяется EmployeeBalanceOwnershipGuard (interface/guards) —
// GET .../balance/employee/:id пускает по нему, только если :id совпадает
// с request.user.employeeId. view_department в каталоге есть, но пока не
// проверяется ни одним guard'ом (тот же приём и то же ограничение, что
// tasks:view_own в tasks.permissions.ts). Реальный гейт остальных
// GET-эндпоинтов (сводка отдела/компании) — по-прежнему view_all.
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
