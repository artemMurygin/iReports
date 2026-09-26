import type { PermissionCatalogEntry } from '@/modules/roles/application/ports/permission-registry.port';

// Реестр permission-кодов для раздела «Настройки» фронтенда
// (`/settings/employee-identity`, `/settings/service-accounts`,
// `/settings/roles`) — тот же паттерн, что ROLES_PERMISSIONS/
// EMPLOYEE_BALANCE_PERMISSIONS (design.md roles, Decision 12).
//
// `settings:view` не проверяется ни одним backend guard'ом: по решению
// пользователя данные employee-identity/service-accounts остаются открыты
// любому аутентифицированному сотруднику (см. комментарий "Гард снят по
// решению пользователя" в list-employee-identities.http.controller.ts) — код
// нужен только для frontend-скрытия всего раздела «Настройки» (нав-пилюля,
// Subnav, Drawer, RouteGuard). У `/settings/roles` он действует ДОПОЛНИТЕЛЬНО
// к уже существующему `roles:manage` (AND, а не замена) — сама страница
// «Роли и права» управляется отдельно, `settings:view` лишь решает,
// показывать ли раздел целиком.
export const SETTINGS_PERMISSIONS: PermissionCatalogEntry[] = [
    {
        code: 'settings:view',
        label: 'Просмотр раздела «Настройки»',
        group: 'Настройки',
    },
];
