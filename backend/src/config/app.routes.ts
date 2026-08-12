const employeeIdentityRoot = 'employee-identity';

// Api Versions
const v1 = 'v1';

// Направление service — все маршруты домена domains/service под общим
// префиксом /v1/service, чтобы направление было видно уже в пути, а не
// только в query/имени модуля (см. shopAccounting/shopWarehouse ниже,
// откуда взят этот приём).
const serviceRoot = `/${v1}/service`;
const serviceMotivationSchemaRoot = `${serviceRoot}/motivation-schema`;
const serviceAccountingRoot = `${serviceRoot}/accounting`;
const serviceSalesPerformanceRoot = `${serviceRoot}/sales/salesPerformance`;
// План продаж (Фаза 3, см. docs/payroll/plan-payroll-calculation.md) —
// раньше жил на общем для всех направлений пути /v1/sales/plan* с
// direction в теле/query запроса; переведён под /v1/service под тем же
// приёмом, что и salesPerformance выше — направление подставляется
// контроллером (direction: 'service'), а не читается из запроса клиента.
// Для shop аналогичный CRUD пока не заведён (см. domains/shop/CLAUDE.md).
const serviceSalesPlanRoot = `${serviceRoot}/sales/plan`;
const serviceSalesPlanTemplateRoot = `${serviceRoot}/sales/plan_template`;
// Список сделок Bitrix24 за диапазон дат создания + пять справочников
// (Фазы 1-2, см. docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md)
// — новый дом для GET /deals(+/stages,/managers,/sources,/stage-groups,
// /models) из backend/src/TODO/deals, тем же приёмом, что и
// salesPlan/salesPlanTemplate выше: путь под /v1/service/sales, диапазон
// дат в query (см. listDealsQuerySchema). Фаза 2 удаляет
// backend/src/TODO/deals целиком — это уже не параллельный, а
// единственный (заменяющий) маршрут.
const serviceDealsRoot = `${serviceRoot}/sales/deals`;
// Отчёт по воронке сервисных сделок (Фаза 4,
// см. docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md)
// — новый дом для GET /reports/service-funnel из backend/src/TODO/reports,
// тем же приёмом, что и serviceDealsRoot выше: путь под /v1/service/sales,
// читает те же bitrix_deals. Легаси-эндпоинт /reports/service-funnel при
// этом не удаляется — параллельный маршрут на время миграции (TODO/reports
// целиком выводится из эксплуатации отдельной фазой этого же трека).
const serviceFunnelReportRoot = `${serviceRoot}/sales/funnel-report`;
// Аналитика услуг и категории услуг (Фаза 5,
// см. docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md)
// — новый дом для GET /reports/services-analytics и /reports/service-categories
// из backend/src/TODO/reports (модуль domains/service/modules/reports,
// каталог TODO/reports целиком удалён этой же фазой). В отличие от
// serviceFunnelReportRoot выше (тот же источник bitrix_deals, что и
// serviceDealsRoot) — это отдельный модуль и отдельный корень пути, читает
// roapp_service_orders/roapp_service_categories, а не bitrix_deals.
const serviceReportsRoot = `${serviceRoot}/reports`;

// Направление shop — все маршруты домена domains/shop под общим префиксом
// /v1/shop.
const shopRoot = `/${v1}/shop`;
const shopAccountingRoot = `${shopRoot}/accounting`;
const shopWarehouseRoot = `${shopRoot}/warehouse`;
// Направление shop (Фаза 11) обслуживается отдельным эндпоинтом, а не тем
// же /sales/salesPerformance/:period с direction=shop в query: читатель
// SalesPerformance направления service (GetSalesPerformanceService) и его
// ERP-источник (RoappSalesFactSourceRepository) жёстко привязаны к
// RoappOrder, поэтому единственный контроллер не может обслужить оба
// направления без домена service, знающего о домене shop (или наоборот) —
// см. отчёт Фазы 11. shopSalesPerformanceRoot — отдельный путь, не query-
// параметр на общем пути, чтобы не создавать двух контроллеров на один и
// тот же путь+метод (Nest/Express однозначно не резолвят такую коллизию).
const shopSalesPerformanceRoot = `${shopRoot}/sales/salesPerformance`;
// SalesPlan/SalesPlanTemplate направления shop — с переходом direction
// команд application/command из query/body в обязательное поле,
// подставляемое контроллером (см. domains/shop/modules/sales/interface/
// http-controllers), CRUD плана/шаблона перестал быть общим маршрутом на
// оба направления (в отличие от Фазы 11) и получил собственный путь под
// /v1/shop, зеркалящий /v1/sales/plan* сервиса — тот же приём, что уже
// применён для shopSalesPerformanceRoot выше.
const shopSalesPlanRoot = `${shopRoot}/sales/plan`;
const shopSalesPlanTemplateRoot = `${shopRoot}/sales/plan_template`;

export const routesV1 = {
    version: v1,
    // Все маршруты этого блока закрыты PortalAdminGuard — доступны только
    // администратору портала Bitrix24 (см. Фаза 2,
    // docs/payroll/prd-payroll-calculation.md, раздел 1).
    employeeIdentity: {
        root: employeeIdentityRoot,
        byId: `/${employeeIdentityRoot}/:id`,
        byEmployee: `/${employeeIdentityRoot}/employee/:employeeId`,
        unmatched: `/${employeeIdentityRoot}/unmatched`,
    },
    // Маршруты направления service (domains/service) — под префиксом
    // /v1/service. Без модели прав в проекте эндпоинты не закрыты гардом, в
    // отличие от employeeIdentity (см. "неблокирующие вопросы" PRD).
    service: {
        motivationSchema: {
            root: serviceMotivationSchemaRoot,
            delete: `${serviceMotivationSchemaRoot}/:id`,
        },
        accounting: {
            salaryRuleTypes: `${serviceAccountingRoot}/salary_role_types`,
            taskCompletions: `${serviceAccountingRoot}/task_completions`,
            taskCompletionById: `${serviceAccountingRoot}/task_completions/:id`,
            confirmTaskCompletion: `${serviceAccountingRoot}/task_completions/:id/confirm`,
            rejectTaskCompletion: `${serviceAccountingRoot}/task_completions/:id/reject`,
            employeeHours: `${serviceAccountingRoot}/employee_hours`,
            employeeHoursById: `${serviceAccountingRoot}/employee_hours/:id`,
            // Расчётный период направления service (Фаза 3) — раньше жил на
            // общем для service/shop пути /accounting/period/:direction/:period
            // с direction, читаемым из route-параметра (см.
            // parseAccountingDirection); переведён под /v1/service тем же
            // приёмом, что и остальные разделы service выше — direction
            // подставляется контроллером (direction: 'service'), а не
            // читается из запроса клиента. Зеркало — shop.accounting.period
            // ниже.
            period: {
                byPeriod: `${serviceAccountingRoot}/period/:period`,
                close: `${serviceAccountingRoot}/period/:period/close`,
                reopen: `${serviceAccountingRoot}/period/:period/reopen`,
                recalculate: `${serviceAccountingRoot}/period/:period/recalculate`,
            },
            // Отчёты по зарплате (Фаза 9) — раньше жили на общем для
            // service/shop пути /accounting/salary_report/*; переведены под
            // /v1/service тем же приёмом, что и остальные разделы service
            // выше. Оба отчёта — по сотруднику (Фаза 13.5) и по отделу —
            // ответ односторонний, только по направлению service (см.
            // GetEmployeeSalaryReportService/GetDepartmentSalaryReportService).
            salaryReport: {
                employee: `${serviceAccountingRoot}/salary_report/employee/:id/:period`,
                department: `${serviceAccountingRoot}/salary_report/department/:id/:period`,
            },
        },
        // SalesFact/SalesPrognose/SalesPerformance (Фаза 5) — период в пути,
        // направление в query (см. listSalesPerformanceQuerySchema).
        salesPerformance: {
            byPeriod: `${serviceSalesPerformanceRoot}/:period`,
        },
        // План продаж (Фаза 3, см. docs/payroll/plan-payroll-calculation.md,
        // см. также комментарий у serviceSalesPlanRoot выше).
        salesPlan: {
            root: serviceSalesPlanRoot,
            byId: `${serviceSalesPlanRoot}/:id`,
            approve: `${serviceSalesPlanRoot}/approve`,
        },
        salesPlanTemplate: {
            root: serviceSalesPlanTemplateRoot,
        },
        // Список сделок (Фаза 3, см. комментарий у serviceDealsRoot выше) —
        // отдельный подобъект deals, а не плоский ключ на уровне service
        // (как salesPerformance/salesPlan/salesPlanTemplate), потому что имя
        // "deals" уже занято сущностью предметной области (DealEntity,
        // DealListItem) и по аналогии с accounting.period/accounting.salaryReport
        // выше группировка в подобъект читается яснее одного плоского пути.
        //
        // stages/managers/sources/stageGroups/models (Фаза 2, см.
        // docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md)
        // — пять справочников сделок, новый дом для GET /deals/{stages,
        // managers,sources,stage-groups,models} из src/TODO/deals; путь
        // /models сохранён как есть (легаси-имя для getDeviceTypes), не
        // переименован в /device-types, чтобы не расходиться с уже
        // задокументированным в ENDPOINTS.md именем маршрута.
        deals: {
            root: serviceDealsRoot,
            stages: `${serviceDealsRoot}/stages`,
            managers: `${serviceDealsRoot}/managers`,
            sources: `${serviceDealsRoot}/sources`,
            stageGroups: `${serviceDealsRoot}/stage-groups`,
            models: `${serviceDealsRoot}/models`,
        },
        // Отчёт по воронке сервисных сделок (Фаза 4, см. комментарий у
        // serviceFunnelReportRoot выше) — отдельный подобъект по тому же
        // принципу, что и deals выше.
        funnelReport: {
            root: serviceFunnelReportRoot,
        },
        // Аналитика услуг и категории услуг (Фаза 5, см. комментарий у
        // serviceReportsRoot выше) — новый модуль domains/service/modules/reports,
        // не modules/sales (иной источник данных: roapp_service_orders, а не
        // bitrix_deals).
        reports: {
            services: `${serviceReportsRoot}/services`,
            serviceCategories: `${serviceReportsRoot}/service-categories`,
        },
    },
    // Маршруты направления shop (domains/shop) — под префиксом /v1/shop.
    shop: {
        // Зарплатные правила магазина (Фаза 12, см. domains/shop/modules/accounting).
        accounting: {
            salaryRuleTypes: `${shopAccountingRoot}/salary_role_types`,
            // Схема мотивации и подтверждение выполненных задач магазина
            // (Фаза 13.5, см. docs/payroll/phase-13.5-shop-report-integration.md)
            // — зеркалят одноимённые маршруты accounting сервиса, но в своём
            // namespace shopAccountingRoot, а не через общие константы сервиса
            // (см. запрет на импорт между domains/service и domains/shop в
            // backend/CLAUDE.md и src/domains/service/CLAUDE.md).
            motivationSchema: `${shopAccountingRoot}/motivation-schema`,
            taskCompletions: `${shopAccountingRoot}/task_completions`,
            taskCompletionById: `${shopAccountingRoot}/task_completions/:id`,
            confirmTaskCompletion: `${shopAccountingRoot}/task_completions/:id/confirm`,
            rejectTaskCompletion: `${shopAccountingRoot}/task_completions/:id/reject`,
            // Расчётный период направления shop (Фаза 3) — зеркалит
            // service.accounting.period выше, в своём namespace
            // shopAccountingRoot (см. запрет на импорт между
            // domains/service и domains/shop в backend/CLAUDE.md).
            period: {
                byPeriod: `${shopAccountingRoot}/period/:period`,
                close: `${shopAccountingRoot}/period/:period/close`,
                reopen: `${shopAccountingRoot}/period/:period/reopen`,
                recalculate: `${shopAccountingRoot}/period/:period/recalculate`,
            },
            // Отчёт по зарплате сотрудника магазина — зеркалит
            // .../accounting/salary_report/employee/:id/:period сервиса
            // (см. GetEmployeeSalaryReportHttpController), но в своём
            // namespace shopAccountingRoot и с собственным (не
            // direction-aware) сервисом GetShopEmployeeSalaryReportService,
            // так как ответ односторонний — один отчёт одного направления
            // (см. employeeSalaryReportResponseSchema в contracts).
            //
            // department — тот же приём для отчёта по отделу
            // (GetShopDepartmentSalaryReportService): в отличие от
            // объединённого .../accounting/salary_report/department/:id/:period
            // сервиса (GetDepartmentSalaryReportService, сводит service и
            // shop в один ответ с комбинированным isClosed), этот отчёт
            // ограничен одним направлением shop — isClosed берётся как есть,
            // без combine-шага по двум направлениям.
            salaryReport: {
                employee: `${shopAccountingRoot}/salary_report/employee/:id/:period`,
                department: `${shopAccountingRoot}/salary_report/department/:id/:period`,
            },
        },
        // Каталог (дерево категорий) магазина (Фаза 1, см.
        // domains/shop/modules/warehouse) — читает уже синхронизированную
        // MoySkladProductFolder, без товаров/остатков.
        warehouse: {
            catalog: `${shopWarehouseRoot}/catalog`,
        },
        // SalesFact/SalesPrognose/SalesPerformance магазина (Фаза 11, см.
        // domains/shop/modules/sales) — свой путь, направление не query-
        // параметр (оно и так подразумевается путём), см. комментарий у
        // shopSalesPerformanceRoot выше.
        salesPerformance: {
            byPeriod: `${shopSalesPerformanceRoot}/:period`,
        },
        // План/шаблон плана продаж направления shop — см. комментарий у
        // shopSalesPlanRoot выше.
        salesPlan: {
            root: shopSalesPlanRoot,
            byId: `${shopSalesPlanRoot}/:id`,
            approve: `${shopSalesPlanRoot}/approve`,
        },
        salesPlanTemplate: {
            root: shopSalesPlanTemplateRoot,
        },
    },
};
