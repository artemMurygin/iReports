import type { PermissionCatalogEntry } from '@/modules/roles/application/ports/permission-registry.port';

// Типизированный реестр permission-кодов модуля domains/service/modules/
// accounting — тот же паттерн, что ROLES_PERMISSIONS/TASKS_PERMISSIONS
// (design.md roles, Decision 12). Раздельно от shop-accounting (см.
// accounting.permissions.ts в domains/shop) — service/shop независимые
// бизнес-линии, роль не должна получать доступ к чужому направлению
// автоматически (см. backend/CLAUDE.md, «Общие таблицы между service и
// shop»).
//
// view_own_salary_report/view_department_salary_report в каталоге есть, но
// пока не проверяются НИ ОДНИМ guard'ом — GetEmployeeSalaryReportService не
// сравнивает request.user с запрошенным :id/отделом (тот же приём и то же
// ограничение, что tasks:view_own в tasks.permissions.ts). Реальный гейт
// эндпоинтов отчёта — view_all_salary_report, единственный код, для
// которого текущее поведение (без сопоставления личности) семантически
// верно уже сейчас.
export const SERVICE_ACCOUNTING_PERMISSIONS: PermissionCatalogEntry[] = [
    {
        code: 'service-accounting:view',
        label: 'Просмотр мотивационных схем, правил и расчётного периода',
        group: 'Зарплата: Сервис',
    },
    {
        code: 'service-accounting:manage_schema',
        label: 'Управление мотивационными схемами и правилами',
        group: 'Зарплата: Сервис',
    },
    {
        code: 'service-accounting:manage_period',
        label: 'Закрытие, переоткрытие и пересчёт расчётного периода',
        group: 'Зарплата: Сервис',
    },
    {
        code: 'service-accounting:view_accrual',
        label: 'Просмотр начислений',
        group: 'Зарплата: Сервис',
    },
    {
        code: 'service-accounting:edit_accrual',
        label: 'Проведение и корректировка начислений',
        group: 'Зарплата: Сервис',
    },
    {
        code: 'service-accounting:manage_payout',
        label: 'Выплаты через кассу RemOnline',
        group: 'Зарплата: Сервис',
    },
    {
        code: 'service-accounting:view_own_salary_report',
        label: 'Просмотр своего отчёта по зарплате',
        group: 'Зарплата: Сервис',
    },
    {
        code: 'service-accounting:view_department_salary_report',
        label: 'Просмотр отчёта по зарплате своего отдела',
        group: 'Зарплата: Сервис',
    },
    {
        code: 'service-accounting:view_all_salary_report',
        label: 'Просмотр отчёта по зарплате любого сотрудника',
        group: 'Зарплата: Сервис',
    },
];
