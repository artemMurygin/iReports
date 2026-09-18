import type { PermissionCatalogEntry } from '@/modules/roles/application/ports/permission-registry.port';

// Типизированный реестр permission-кодов модуля domains/shop/modules/
// accounting — зеркало SERVICE_ACCOUNTING_PERMISSIONS (см. WHY там), но
// раздельные коды: service/shop независимые бизнес-линии.
export const SHOP_ACCOUNTING_PERMISSIONS: PermissionCatalogEntry[] = [
    {
        code: 'shop-accounting:view',
        label: 'Просмотр мотивационных схем, правил и расчётного периода',
        group: 'Зарплата: Магазин',
    },
    {
        code: 'shop-accounting:manage_schema',
        label: 'Управление мотивационными схемами и правилами',
        group: 'Зарплата: Магазин',
    },
    {
        code: 'shop-accounting:manage_period',
        label: 'Закрытие, переоткрытие и пересчёт расчётного периода',
        group: 'Зарплата: Магазин',
    },
    {
        code: 'shop-accounting:view_accrual',
        label: 'Просмотр начислений',
        group: 'Зарплата: Магазин',
    },
    {
        code: 'shop-accounting:edit_accrual',
        label: 'Проведение и корректировка начислений',
        group: 'Зарплата: Магазин',
    },
    {
        code: 'shop-accounting:manage_payout',
        label: 'Выплаты через кассу МойСклад',
        group: 'Зарплата: Магазин',
    },
    {
        code: 'shop-accounting:view_own_salary_report',
        label: 'Просмотр своего отчёта по зарплате',
        group: 'Зарплата: Магазин',
    },
    {
        code: 'shop-accounting:view_department_salary_report',
        label: 'Просмотр отчёта по зарплате своего отдела',
        group: 'Зарплата: Магазин',
    },
    {
        code: 'shop-accounting:view_all_salary_report',
        label: 'Просмотр отчёта по зарплате любого сотрудника',
        group: 'Зарплата: Магазин',
    },
];
