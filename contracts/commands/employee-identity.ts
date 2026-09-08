import { z } from 'zod';

// Идентификация сотрудника между Bitrix24 / RemOnline / МойСклад (Фаза 2,
// см. docs/payroll/plan-payroll-calculation.md). Роль здесь не хранится —
// роль остаётся атрибутом зарплатного правила (см. targetRoleSchema в
// ./salary-rule) и не имеет отношения к тому, кто есть кто в ERP.

// ========================== Система и тип идентификатора ========================== //

const externalSystemSchema = z.enum(['ROAPP', 'MOY_SKLAD']);
export type ExternalSystem = z.infer<typeof externalSystemSchema>;

// EMPLOYEE_ID — ссылка на сотрудника в ERP (RoappEmployee.id, MoySkladEmployee.id).
// ONLINE_MANAGER_FIELD — значение строкового кастомного поля RemOnline
// («онлайн-менеджер»), для которого связи по ID не существует.
// MOY_SKLAD_ONLINE_PURCHASER_FIELD / MOY_SKLAD_OFFLINE_PURCHASER_FIELD —
// значение доп. поля закупщика БУ техники на позиции отгрузки МойСклада
// (Фаза 10, см. docs/payroll/prd-payroll-calculation.md, раздел "Роли
// магазина"): тип атрибута МойСклад заранее не известен (employee-ссылка
// или произвольная строка), поэтому сопоставление — тем же механизмом, что
// ONLINE_MANAGER_FIELD, по значению, а не по ID.
const employeeIdentityTypeSchema = z.enum([
    'EMPLOYEE_ID',
    'ONLINE_MANAGER_FIELD',
    'MOY_SKLAD_ONLINE_PURCHASER_FIELD',
    'MOY_SKLAD_OFFLINE_PURCHASER_FIELD',
]);
export type EmployeeIdentityType = z.infer<typeof employeeIdentityTypeSchema>;

// ========================== EmployeeIdentity ========================== //

const employeeIdentitySchema = z.object({
    id: z.string(),
    bitrixEmployeeId: z.number(),
    system: externalSystemSchema,
    identifierType: employeeIdentityTypeSchema,
    externalId: z.string(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

export type EmployeeIdentityResponse = z.infer<typeof employeeIdentitySchema>;

const createEmployeeIdentitySchema = z.object({
    bitrixEmployeeId: z.number(),
    system: externalSystemSchema,
    identifierType: employeeIdentityTypeSchema,
    externalId: z.string().min(1),
});

export type CreateEmployeeIdentityRequest = z.infer<
    typeof createEmployeeIdentitySchema
>;

// Правка меняет только сам идентификатор/его тип — сотрудник и система, к
// которой привязана запись, у существующей связи не переезжают: это была бы
// уже другая связь, а не правка этой.
const updateEmployeeIdentitySchema = z.object({
    identifierType: employeeIdentityTypeSchema.optional(),
    externalId: z.string().min(1).optional(),
});

export type UpdateEmployeeIdentityRequest = z.infer<
    typeof updateEmployeeIdentitySchema
>;

// ========================== Сотрудник без связей ========================== //

const unmatchedEmployeeSchema = z.object({
    id: z.number(),
    firstName: z.string(),
    lastName: z.string(),
    departmentId: z.number(),
});

export type UnmatchedEmployeeResponse = z.infer<typeof unmatchedEmployeeSchema>;

export {
    externalSystemSchema,
    employeeIdentityTypeSchema,
    employeeIdentitySchema,
    createEmployeeIdentitySchema,
    updateEmployeeIdentitySchema,
    unmatchedEmployeeSchema,
};
