import type { PermissionCatalogEntry } from '@/modules/roles/application/ports/permission-registry.port';

// Типизированный реестр permission-кодов модуля work-schedule (design.md
// roles, Decision 12 — тот же паттерн, что и ROLES_PERMISSIONS в
// src/modules/roles/roles.permissions.ts). Два кода, без подразумеваемой
// иерархии между ними (просмотр не даёт право редактировать, и наоборот —
// как и у roles:view/roles:manage): "view" закрывает GET-эндпоинты (месяц,
// состав смены), "manage" — мутирующие (создать/изменить/удалить запись).
export const WORK_SCHEDULE_PERMISSIONS: PermissionCatalogEntry[] = [
    {
        code: 'work-schedule:view',
        label: 'Просмотр графика работы',
        group: 'График работы',
    },
    {
        code: 'work-schedule:manage',
        label: 'Редактирование графика работы',
        group: 'График работы',
    },
];
