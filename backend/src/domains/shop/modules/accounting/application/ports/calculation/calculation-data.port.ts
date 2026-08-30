import type { EmployeeIdentityRef } from '@/shared/domain/calculation-context';
import type {
    PayPerHourHours,
    ShopProductSoldErpItem,
    ShopTaskCompletionErpItem,
} from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';

// Источник данных для сборки CalculationContext направления shop (Фаза
// 13.5) — независимая реализация, зеркало ServiceCalculationDataPort
// (domains/service/modules/accounting/application/ports/
// service-calculation-data.port.ts), не переиспользуется (issue #57): один
// связный порт на весь контекст расчёта, а не по одному на источник — см.
// BuildShopCalculationContextService, единственный потребитель.
export interface ShopCalculationDataPort {
    // Идентификация сотрудника во внешних системах — вход для ролевого
    // сопоставления правил (см. role-source.ts). Весь список identities
    // сотрудника, БЕЗ предфильтра по system — каждое правило само фильтрует
    // свою выборку через role-source.ts (зеркало
    // ServiceCalculationDataRepository.findEmployeeIdentities).
    findEmployeeIdentities(
        bitrixEmployeeId: number,
    ): Promise<EmployeeIdentityRef[]>;

    // Отработанные часы сотрудника за период (только дни графика с ролью
    // из PayPerHourShopEntity.ELIGIBLE_SCHEDULE_ROLES) — та же общая,
    // направление-агностичная таблица графика, что и у service. Пара факт
    // (по сегодняшний день включительно)
    // / прогноз (весь период) — now: необязательный параметр с дефолтом
    // new Date(), точка инъекции "сегодня" в тестах. 0 по обоим полям, если
    // подходящих рабочих смен нет.
    findHoursWorked(
        bitrixEmployeeId: number,
        period: string,
        now?: Date,
    ): Promise<PayPerHourHours>;

    // Позиции отгрузок за период (Фаза 13, issue #63: "один источник на
    // ProductSold И UsedProductSold") — период-широкий набор, без фильтра по
    // сотруднику: одно и то же erpData используется всеми правилами схемы,
    // каждое фильтрует свою выборку по своей роли само.
    findProductSoldItems(
        from: Date,
        to: Date,
    ): Promise<ShopProductSoldErpItem[]>;

    // Подтверждённые записи о выполнении задач за период (Фаза 13,
    // direction: 'shop') — источник для TaskCompletedShopEntity.
    findConfirmedTaskCompletions(
        period: string,
    ): Promise<ShopTaskCompletionErpItem[]>;

    // Отдел Bitrix-сотрудника — вход для поиска ShopSalesPerformance
    // подразделения (вход FloatPercent).
    findEmployeeDepartmentId(bitrixEmployeeId: number): Promise<number | null>;

    // Все сотрудники отдела — вход отчёта GET
    // /accounting/salary_report/department/:id/:period, один запрос на весь
    // отдел (не по одному на сотрудника).
    findEmployeesInDepartment(
        departmentId: number,
    ): Promise<{ id: number; name: string }[]>;

    // Батч-версия findEmployeeIdentities для отдела целиком — не должно
    // быть N+1 запросов при расчёте отдела.
    findEmployeeIdentitiesForEmployees(
        bitrixEmployeeIds: number[],
    ): Promise<Map<number, EmployeeIdentityRef[]>>;

    // Батч-версия findHoursWorked для отдела целиком.
    findHoursWorkedForEmployees(
        bitrixEmployeeIds: number[],
        period: string,
        now?: Date,
    ): Promise<Map<number, PayPerHourHours>>;

    // Раскрытие категории правила ProductSold/UsedProductSold до всех
    // потомков дерева MoySkladProductFolder (issue #50) — один батч-вызов на
    // уникальные id категорий всей схемы, а не по одному на правило (см.
    // BuildShopCalculationContextService.collectCategoryIds). Переиспользует
    // уже готовый ProductFolderTreeService.resolveDescendantFolderIds
    // (domains/shop/sync/moySklad) — это кросс-МОДУЛЬНОЕ (не кросс-доменное)
    // переиспользование внутри shop, корректно по issue #57. rootFolderId
    // без соответствия (несуществующая папка) — пустой массив по ключу.
    resolveCategoryDescendantFolderIds(
        rootFolderIds: string[],
    ): Promise<Record<string, string[]>>;
}

export const SHOP_CALCULATION_DATA = Symbol('SHOP_CALCULATION_DATA');
