const motivationSchemaRoot = 'motivation-schema';
const employeeIdentityRoot = 'employee-identity';
const salesPlanRoot = 'sales/plan';
const salesPlanTemplateRoot = 'sales/plan_template';

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
};
