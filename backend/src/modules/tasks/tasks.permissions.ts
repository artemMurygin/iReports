import type { PermissionCatalogEntry } from '@/modules/roles/application/ports/permission-registry.port';

// Типизированный реестр permission-кодов модуля tasks — тот же паттерн, что
// ROLES_PERMISSIONS/WORK_SCHEDULE_PERMISSIONS (design.md roles, Decision 12).
// Гранулярный набор (а не единый view/manage, как у остальных модулей):
// у задачи есть граф статусов с ревью-циклом и подсущности (комментарии,
// ссылки), которыми на практике управляют разные роли (исполнитель меняет
// статус, но не обязательно может удалить задачу или менять ссылки).
// tasks:view_own в каталоге есть, но пока не проверяется ни одним guard'ом —
// список задач (ListTasksService) не фильтрует по assigneeEmployeeId; это
// отдельная задача на фильтрацию, не часть текущего изменения.
export const TASKS_PERMISSIONS: PermissionCatalogEntry[] = [
    {
        code: 'tasks:view',
        label: 'Просмотр всех задач',
        group: 'Задачи',
    },
    {
        code: 'tasks:view_own',
        label: 'Просмотр только своих задач',
        group: 'Задачи',
    },
    {
        code: 'tasks:create',
        label: 'Создание задачи',
        group: 'Задачи',
    },
    {
        code: 'tasks:edit',
        label: 'Редактирование задачи',
        group: 'Задачи',
    },
    {
        code: 'tasks:delete',
        label: 'Удаление задачи',
        group: 'Задачи',
    },
    {
        code: 'tasks:change_status',
        label: 'Смена статуса задачи',
        group: 'Задачи',
    },
    {
        code: 'tasks:comment',
        label: 'Комментирование задачи',
        group: 'Задачи',
    },
    {
        code: 'tasks:manage_links',
        label: 'Управление ссылками задачи',
        group: 'Задачи',
    },
];
