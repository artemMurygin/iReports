const motivationSchemaRoot = 'motivation-schema';
const employeeIdentityRoot = 'employee-identity';

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
};
