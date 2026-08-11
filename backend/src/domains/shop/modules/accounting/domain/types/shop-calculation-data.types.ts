// Форма CalculationContext.erpData для направления shop (Фаза 12, зеркало
// ServiceCalculationErpData сервиса). Собирается application-слоем
// (будущий BuildShopCalculationContextService — по образцу
// build-service-calculation-context.service.ts сервиса, вне скоупа Фазы
// 12/13: ни один из выданных issues 57-66 не требует HTTP-эндпоинта
// создания мотивационной схемы/отчёта по зарплате магазина, поэтому
// оркестратор, реально наполняющий эту структуру из БД, не существует —
// правила уже готовы её потреблять, когда он появится) один раз на всю
// мотивационную схему сотрудника и передаётся неизменным во все его
// правила.
export interface ShopProductSoldErpItem {
    // MoySkladDemandPosition.id — источник дедупликации "правило × позиция"
    // (issue #61).
    positionId: string;
    demandId: string;
    // MoySkladProduct.folderId / MoySkladService.folderId позиции —
    // собственная (листовая) категория товара/услуги, не раскрытая до
    // предков. Раскрытие категории правила до потомков сравнивается с этим
    // полем через categoryDescendantFolderIds (см. ниже), а не наоборот.
    folderId: string | null;
    // MoySkladDemandPosition.quantity — Float (весовой/дробный товар,
    // issue #60).
    quantity: number;
    // База REVENUE — MoySkladDemandPosition.sum.
    sum: number;
    // База MARGIN — MoySkladDemandPosition.profit (не sum - cost, то же
    // решение, что и у ShopSalesFact направления sales, Фаза 11).
    profit: number;
    // Поля отгрузки-владельца позиции — денормализованы сюда, чтобы
    // ProductSold мог сматчить роль (ONLINE_MANAGER/OFFLINE_MANAGER) без
    // отдельного join на уровне домена.
    onlineManagerId: string | null;
    offlineManagerId: string | null;
}

export interface ShopCalculationErpData {
    // Источник PayPerHour.calculate() — тот же EmployeeHoursEntry, что и у
    // сервиса (Фаза 7/12), ручной ввод часов сотрудника за период.
    hoursWorked?: number;
    productSoldItems?: ShopProductSoldErpItem[];
    // Раскрытие категории правила ProductSold до всех потомков дерева
    // MoySkladProductFolder (issue #60: "категория указывается папкой...
    // под правило попадают все её потомки"), ключ — id корневой папки из
    // ProductSoldSalaryConfig.category. Правило — чистая функция без IO
    // (см. backend/CLAUDE.md), поэтому раскрытие (обычно —
    // ProductFolderTreeService.resolveDescendantFolderIds, домен shop,
    // sync/moySklad) обязано случиться заранее, на application-слое,
    // строящем контекст; правило лишь смотрит значение по ключу. Категория
    // задана, а карты для неё нет — считается, что позиция не подходит
    // (fail closed, см. product-sold.entity.ts) — так неполный контекст не
    // переплатит сотруднику.
    categoryDescendantFolderIds?: Record<string, string[]>;
}
