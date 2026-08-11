const motivationSchemaRoot = 'motivation-schema';
const employeeIdentityRoot = 'employee-identity';
const salesPlanRoot = 'sales/plan';
const salesPlanTemplateRoot = 'sales/plan_template';
const salesPerformanceRoot = 'sales/salesPerformance';
// Направление shop (Фаза 11) обслуживается отдельным эндпоинтом, а не тем
// же /sales/salesPerformance/:period с direction=shop в query: читатель
// SalesPerformance направления service (GetSalesPerformanceService) и его
// ERP-источник (RoappSalesFactSourceRepository) жёстко привязаны к
// RoappOrder, поэтому единственный контроллер не может обслужить оба
// направления без домена service, знающего о домене shop (или наоборот) —
// см. отчёт Фазы 11. shopSalesPerformanceRoot — отдельный путь, не query-
// параметр на общем пути, чтобы не создавать двух контроллеров на один и
// тот же путь+метод (Nest/Express однозначно не резолвят такую коллизию).
const shopSalesPerformanceRoot = 'sales/salesPerformance/shop';
// Модуль accounting магазина (Фаза 12, issue #57/#61) — собственный
// namespace 'shop/accounting', отдельный от 'accounting' сервиса
// (см. domains/service/modules/accounting), чтобы GET списка типов правил
// каждого направления был самостоятельным HTTP-роутом, а не query-веткой
// одного эндпоинта (тот же приём, что у shopSalesPerformanceRoot выше).
const shopAccountingRoot = 'shop/accounting';

// Api Versions
const v1 = 'v1';

export const routesV1 = {
    version: v1,
    motivationSchema: {
        root: motivationSchemaRoot,
        delete: `/${motivationSchemaRoot}/:id`,
    },
    // Все маршруты этого блока закрыты PortalAdminGuard — доступны только
    // администратору портала Bitrix24 (см. Фаза 2,
    // docs/payroll/prd-payroll-calculation.md, раздел 1).
    employeeIdentity: {
        root: employeeIdentityRoot,
        byId: `/${employeeIdentityRoot}/:id`,
        byEmployee: `/${employeeIdentityRoot}/employee/:employeeId`,
        unmatched: `/${employeeIdentityRoot}/unmatched`,
    },
    // План продаж (Фаза 3, см. docs/payroll/plan-payroll-calculation.md) —
    // без модели прав в проекте эндпоинты не закрыты гардом, в отличие от
    // employeeIdentity (см. "неблокирующие вопросы" PRD).
    salesPlan: {
        root: salesPlanRoot,
        byId: `/${salesPlanRoot}/:id`,
        approve: `/${salesPlanRoot}/approve`,
    },
    salesPlanTemplate: {
        root: salesPlanTemplateRoot,
    },
    // SalesFact/SalesPrognose/SalesPerformance (Фаза 5) — период в пути,
    // направление в query (см. listSalesPerformanceQuerySchema).
    salesPerformance: {
        byPeriod: `/${salesPerformanceRoot}/:period`,
    },
    // SalesFact/SalesPrognose/SalesPerformance магазина (Фаза 11, см.
    // domains/shop/modules/sales) — свой путь, направление не query-
    // параметр (оно и так подразумевается путём), см. комментарий у
    // shopSalesPerformanceRoot выше.
    shopSalesPerformance: {
        byPeriod: `/${shopSalesPerformanceRoot}/:period`,
    },
    // Зарплатные правила магазина (Фаза 12, см. domains/shop/modules/accounting).
    shopAccounting: {
        salaryRuleTypes: `/${shopAccountingRoot}/salary_role_types`,
        // Схема мотивации и подтверждение выполненных задач магазина
        // (Фаза 13.5, см. docs/payroll/phase-13.5-shop-report-integration.md)
        // — зеркалят одноимённые маршруты accounting сервиса, но в своём
        // namespace shopAccountingRoot, а не через общие константы сервиса
        // (см. запрет на импорт между domains/service и domains/shop в
        // backend/CLAUDE.md и src/domains/service/CLAUDE.md).
        motivationSchema: `/${shopAccountingRoot}/motivation-schema`,
        taskCompletions: `/${shopAccountingRoot}/task_completions`,
        taskCompletionById: `/${shopAccountingRoot}/task_completions/:id`,
        confirmTaskCompletion: `/${shopAccountingRoot}/task_completions/:id/confirm`,
        rejectTaskCompletion: `/${shopAccountingRoot}/task_completions/:id/reject`,
    },
};
