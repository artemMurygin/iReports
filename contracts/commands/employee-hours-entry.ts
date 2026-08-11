import { z } from 'zod';

// Ручной ввод отработанных часов сотрудника за период — минимальный источник
// данных, которым питается PayPerHour.calculate() (полноценный график работы
// вне скоупа этой итерации, см. docs/payroll/plan-payroll-calculation.md,
// Фаза 7, и prd-payroll-calculation.md, раздел "Не в скоупе"). Одна запись —
// одно значение часов на пару (сотрудник, период); правка существующей
// записи заменяет значение целиком. Направление (service/shop) на схеме не
// фиксируется полем: сущность целиком принадлежит domains/service/modules/accounting,
// у магазина при необходимости появится собственная независимая сущность
// (Фаза 12), а не переиспользование этой.

const periodSchema = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Период должен быть в формате YYYY-MM');

const employeeHoursEntrySchema = z.object({
    id: z.string(),
    employeeId: z.number(),
    period: periodSchema,
    hours: z.number().nonnegative(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});
export type EmployeeHoursEntryResponse = z.infer<
    typeof employeeHoursEntrySchema
>;

const createEmployeeHoursEntryRequestSchema = z.object({
    employeeId: z.number(),
    period: periodSchema,
    hours: z.number().nonnegative(),
});
export type CreateEmployeeHoursEntryRequest = z.infer<
    typeof createEmployeeHoursEntryRequestSchema
>;

const updateEmployeeHoursEntryRequestSchema = z.object({
    hours: z.number().nonnegative(),
});
export type UpdateEmployeeHoursEntryRequest = z.infer<
    typeof updateEmployeeHoursEntryRequestSchema
>;

const listEmployeeHoursEntriesQuerySchema = z.object({
    period: periodSchema,
    employeeId: z.coerce.number().optional(),
});
export type ListEmployeeHoursEntriesQuery = z.infer<
    typeof listEmployeeHoursEntriesQuerySchema
>;

export {
    employeeHoursEntrySchema,
    createEmployeeHoursEntryRequestSchema,
    updateEmployeeHoursEntryRequestSchema,
    listEmployeeHoursEntriesQuerySchema,
};
