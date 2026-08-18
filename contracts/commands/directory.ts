import { z } from 'zod';

// Справочник отделов и сотрудников Bitrix24 (BitrixDepartment/BitrixEmployee,
// prisma/schema/bitrix.prisma) — питает селекты «Отдел»/«Сотрудник» на Шаге 1
// формы создания зарплатной схемы (docs/salary-schema-creation-ui,
// Фаза 1: до этого модуля справочник существовал только в БД, наружу
// не отдавался). Модуль общий, не привязан к домену service/shop (см.
// modules/directory в backend), поэтому схемы не переиспользуют
// dealAssigneeSchema/unmatchedEmployeeSchema из соседних контрактов —
// у тех своя, независимая форма (без name/departmentId соответственно),
// продиктованная их собственными эндпоинтами.

const departmentSchema = z.object({
    id: z.number(),
    name: z.string(),
});
export type DepartmentResponse = z.infer<typeof departmentSchema>;

// name — «firstName lastName» (тот же порядок, что уже принят на фронтенде
// для отображения сотрудника, см. frontend DealsByManagerChart/useManagerStats),
// собран на бэкенде, чтобы фронтенду не пришлось знать про разбиение имени.
const employeeSchema = z.object({
    id: z.number(),
    name: z.string(),
    departmentId: z.number(),
});
export type EmployeeResponse = z.infer<typeof employeeSchema>;

const listDepartmentsResponseSchema = z.array(departmentSchema);
export type ListDepartmentsResponse = z.infer<
    typeof listDepartmentsResponseSchema
>;

// departmentId — необязательный фильтр; без него отдаются сотрудники всех
// отделов. z.coerce.number() (не z.coerce.date()) в query безопасен для
// генерации OpenAPI — тот же приём, что и listEmployeeHoursEntriesQuerySchema
// (см. contracts/commands/employee-hours-entry.ts).
const listEmployeesQuerySchema = z.object({
    departmentId: z.coerce.number().int().positive().optional(),
});
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;

const listEmployeesResponseSchema = z.array(employeeSchema);
export type ListEmployeesResponse = z.infer<typeof listEmployeesResponseSchema>;

export {
    departmentSchema,
    employeeSchema,
    listDepartmentsResponseSchema,
    listEmployeesQuerySchema,
    listEmployeesResponseSchema,
};
