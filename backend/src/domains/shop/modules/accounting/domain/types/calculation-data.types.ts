// Форма CalculationContext.erpData для направления shop (Фаза 12/13,
// зеркало ServiceCalculationErpData сервиса). Собирается application-слоем
// (будущий BuildShopCalculationContextService — по образцу
// build-service-calculation-context.service.ts сервиса). Этот сервис
// сознательно НЕ реализуется в Фазе 12/13 — ни один из выданных issues
// 57-66 не требует HTTP-эндпоинта создания мотивационной схемы/отчёта по
// зарплате магазина (см. accounting.module.ts — тот же решённый
// вопрос, что и "путь записи"), поэтому оркестратор, реально наполняющий
// эту структуру из БД, не существует — правила уже готовы её потреблять,
// когда он появится. Один раз на всю мотивационную схему сотрудника и
// передаётся неизменным во все его правила.
export interface ShopProductSoldErpItem {
    // MoySkladDemandPosition.id — источник дедупликации "правило × позиция"
    // (issue #61/#65).
    positionId: string;
    demandId: string;
    // MoySkladDemandPosition.assortmentName — денормализованное название
    // товара/услуги позиции (Фаза 3 плана
    // docs/salary-accrual-source-item-detail/plan-salary-accrual-source-item-detail.md),
    // зеркало OrderPayedErpItem.label по назначению — попадает в
    // CalculationSourceRef.itemName источников ProductSold/UsedProductSold.
    itemName: string;
    // MoySkladDemand.name — человекочитаемый номер/название документа
    // отгрузки, аналог RoappOrder.label у сервиса; вместе с demandId выше
    // используется для построения ссылки на карточку отгрузки
    // (buildErpDemandLink, domain/services/erp-demand-link-builder.ts).
    demandLabel: string;
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
    // Закупщик БУ техники — уровень ТОВАРНОЙ ПОЗИЦИИ, а не отгрузки (Фаза
    // 10/13, issue #62/#63). UsedProductSold матчит роль ONLINE_PURCHASER/
    // OFFLINE_PURCHASER по этим же двум полям того же массива
    // productSoldItems, что использует ProductSold для менеджерских
    // ролей — issue #63: "переиспользуй тот же источник данных, что и
    // ProductSold, не изобретай отдельный источник данных под выкуп".
    // Момент начисления закупщику от этого автоматически становится
    // ПРОДАЖЕЙ, а не выкупом: productSoldItems уже отфильтрован
    // application-слоем по MoySkladDemand.moment своей отгрузки, попадая
    // только за позиции периода — выкупленный, но ещё не проданный остаток
    // в этот массив не попадает вообще.
    onlinePurchaserId: string | null;
    offlinePurchaserId: string | null;
}

// Источник TaskCompleted.calculate() магазина (Фаза 13, issue #64) —
// зеркало ConfirmedTaskCompletionErpItem сервиса
// (service-calculation-data.types.ts). Что считается "задачей" для
// TaskCompleted в магазине — открытый вопрос PRD, не решённый ни для
// сервиса, ни для магазина ("Открытые вопросы", "Что считается задачей для
// TaskCompleted в магазине"). Решение по умолчанию: то же временное
// решение, что и у сервиса в Фазе 8, — тот же внутренний двухступенчатый
// воркфлоу подтверждения (TaskCompletion, domains/service/modules/
// accounting/domain/entities/task-completion.entity.ts), различаемый по
// TaskCompletion.direction (Prisma-поле, добавлено в Фазе 13 — см.
// комментарий у направления в prisma/schema/salary.prisma) вместо
// заведения шоп-специфичного дубликата сущности: у "выполненной задачи"
// нет собственных данных ERP (это ручная отметка руководителя, а не запись
// RemOnline/МойСклад), поэтому дублировать саму таблицу ради направления
// избыточно — коллизия та же, что у SalaryRule.direction (см. там), решение
// то же самое (общее поле-дискриминатор на общей таблице, а не отдельная
// сущность на домен).
export interface ShopTaskCompletionErpItem {
    id: string;
    employeeId: number;
}

// Пара факт/прогноз часов PayPerHour — зеркало PayPerHourHours сервиса (см.
// service-calculation-data.types.ts). fact — сумма часов графика по
// сегодняшний день включительно, prognose — сумма часов графика за весь
// период (включая ещё не наступившие дни).
export interface PayPerHourHours {
    fact: number;
    prognose: number;
}

export interface ShopCalculationErpData {
    // Источник PayPerHour.calculate() — сумма часов рабочих смен графика
    // (WorkScheduleEntry.status = WORKING) с ролью дня из
    // PayPerHourShopEntity.ELIGIBLE_SCHEDULE_ROLES, тот же источник, что и
    // у сервиса.
    hoursWorked?: PayPerHourHours;
    // Источник ProductSold И UsedProductSold (Фаза 13, issue #63) — один
    // массив на оба правила, см. комментарий у onlinePurchaserId выше.
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
    // переплатит сотруднику. Используется и UsedProductSold (Фаза 13) —
    // его необязательная категория раскрывается тем же механизмом.
    categoryDescendantFolderIds?: Record<string, string[]>;
    // Источник TaskCompleted.calculate() магазина (Фаза 13) — см.
    // ShopTaskCompletionErpItem выше.
    taskCompletions?: ShopTaskCompletionErpItem[];
}
