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
// генерации OpenAPI — тот же приём, что и у departmentId в
// getMonthlyWorkScheduleQuerySchema (см. contracts/commands/work-schedule.ts).
const listEmployeesQuerySchema = z.object({
    departmentId: z.coerce.number().int().positive().optional(),
});
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;

const listEmployeesResponseSchema = z.array(employeeSchema);
export type ListEmployeesResponse = z.infer<typeof listEmployeesResponseSchema>;

// Сохранение нового порядка сотрудников (docs/employee-ordering-and-salary-filter,
// Фаза 1) — PATCH .../employees/order. Порядок глобальный (один на всю
// компанию, не на страницу/отдел, см. PRD "Не в скоупе"), поэтому запрос не
// принимает department — items содержит employeeId + новый order КАЖДОГО
// переставленного сотрудника (тот же батч-приём, что и у
// updateSalesPlanOrderRequestSchema в contracts/commands/sales-plan.ts).
// Доступно любому авторизованному пользователю без отдельных прав (PRD, "В
// скоупе" п.5) — эндпоинт намеренно не гардируется.
const reorderEmployeesItemSchema = z.object({
    employeeId: z.number().int(),
    order: z.number().int(),
});
export type ReorderEmployeesItem = z.infer<typeof reorderEmployeesItemSchema>;

const reorderEmployeesRequestSchema = z.object({
    items: z.array(reorderEmployeesItemSchema).min(1),
});
export type ReorderEmployeesRequest = z.infer<
    typeof reorderEmployeesRequestSchema
>;

// Ответ — весь справочник сотрудников уже в новом порядке (тот же список,
// что отдаёт GET .../employees без фильтра по отделу), чтобы клиенту не
// пришлось делать отдельный повторный запрос после сохранения, чтобы
// увидеть применённый порядок.
const reorderEmployeesResponseSchema = listEmployeesResponseSchema;
export type ReorderEmployeesResponse = z.infer<
    typeof reorderEmployeesResponseSchema
>;

// Включение/выключение признака «служебный аккаунт» (docs/employee-ordering-
// and-salary-filter, Фаза 3) — PATCH .../employees/:id/service-account.
// employeeSchema (id/name/departmentId) специально не расширен полем
// isServiceAccount напрямую: остальные потребители справочника (селекты
// «Отдел»/«Сотрудник», reorder-ответ) его не читают, поле нужно только этому
// эндпоинту, поэтому вынесено в отдельную схему-расширение, а не добавлено
// в общий employeeSchema.
const employeeWithServiceAccountSchema = employeeSchema.extend({
    isServiceAccount: z.boolean(),
});
export type EmployeeWithServiceAccountResponse = z.infer<
    typeof employeeWithServiceAccountSchema
>;

const setEmployeeServiceAccountRequestSchema = z.object({
    isServiceAccount: z.boolean(),
});
export type SetEmployeeServiceAccountRequest = z.infer<
    typeof setEmployeeServiceAccountRequestSchema
>;

// Ответ — обновлённый сотрудник целиком (id/name/departmentId +
// isServiceAccount), тем же приёмом, что и у reorder-ответа: клиенту не
// нужен отдельный повторный GET, чтобы увидеть применённое состояние.
const setEmployeeServiceAccountResponseSchema = employeeWithServiceAccountSchema;
export type SetEmployeeServiceAccountResponse = z.infer<
    typeof setEmployeeServiceAccountResponseSchema
>;

// Полный справочник сотрудников (ВСЕ, включая служебные аккаунты) с их
// текущим isServiceAccount — GET .../employees/service-accounts
// (docs/employee-ordering-and-salary-filter, Фаза 4). Отдельная точка от
// listEmployeesResponseSchema/GET .../employees намеренно: тот эндпоинт
// специально ИСКЛЮЧАЕТ служебные аккаунты и не отдаёт флаг (см. WHY у
// listEmployeesQuerySchema/EmployeeSummary.isServiceAccount на бэкенде) —
// его потребители (зарплатные списки/справочник выбора сотрудника) не
// должны их видеть. Этот эндпоинт — наоборот: питает список с
// переключателем «исключить из зарплаты» на странице настроек (нужны ВСЕ
// сотрудники + их текущий признак) и справочник сотрудников на странице
// «Связи сотрудников» (`pages/EmployeeIdentity`, PRD "Не в скоупе":
// "Скрытие служебных аккаунтов за пределами зарплатного раздела" — эта
// страница обязана продолжать видеть служебные аккаунты).
const listEmployeesWithServiceAccountResponseSchema = z.array(
    employeeWithServiceAccountSchema,
);
export type ListEmployeesWithServiceAccountResponse = z.infer<
    typeof listEmployeesWithServiceAccountResponseSchema
>;

export {
    departmentSchema,
    employeeSchema,
    listDepartmentsResponseSchema,
    listEmployeesQuerySchema,
    listEmployeesResponseSchema,
    reorderEmployeesItemSchema,
    reorderEmployeesRequestSchema,
    reorderEmployeesResponseSchema,
    employeeWithServiceAccountSchema,
    setEmployeeServiceAccountRequestSchema,
    setEmployeeServiceAccountResponseSchema,
    listEmployeesWithServiceAccountResponseSchema,
};
