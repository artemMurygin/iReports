import { z } from 'zod';
import { periodSchema, salesDirectionSchema } from './sales-plan';
import { calculationLineSchema, targetRoleSchema } from './salary-rule';
import { salaryAccrualStatusSchema } from './salary-accrual-status';

// Документ начисления зарплаты (PRD 1 docs/payroll-closing-and-accrual/
// prd-accounting-period-closing-pipeline.md, раздел "Документ начисления
// (SalaryAccrual)") — создаётся закрытием расчётного периода по каждому
// сотруднику снапшота, один документ на (direction, period, employeeId).
// Денежные поля — в тех же единицах, что и снапшот периода (целые рубли,
// см. AccountingPeriodSnapshot.total: Int и roundRubles() на бэкенде).

// ========================== Статусы ========================== //

// salaryAccrualStatusSchema — см. salary-accrual-status.ts (общий с отчётом
// по зарплате сотрудника).

// Статус строки документа (PRD 2: DRAFT ⇄ ACCRUED, PRD 3: PAID) — в PRD 1
// строка всегда DRAFT, перечень тоже фиксируется сразу.
const salaryAccrualLineStatusSchema = z.enum(['DRAFT', 'ACCRUED', 'PAID']);
export type SalaryAccrualLineStatus = z.infer<
    typeof salaryAccrualLineStatusSchema
>;

// ========================== Строка документа ========================== //

// Одна строка на зарплатное правило из разбивки снапшота — повторяет
// RuleBreakdownLine снапшота один в один (calculationLineSchema + атрибуты
// правила type/name/targetRole). originalAmount — сумма из снапшота на
// момент закрытия, amount — действующая сумма строки (в PRD 1 всегда равна
// originalAmount; корректировка с комментарием — PRD 2).
const salaryAccrualLineSchema = calculationLineSchema.extend({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    targetRole: targetRoleSchema,
    originalAmount: z.number(),
    status: salaryAccrualLineStatusSchema,
});
export type SalaryAccrualLine = z.infer<typeof salaryAccrualLineSchema>;

// ========================== Документ ========================== //

// Строка списка начислений за период: ФИО и отдел резолвятся из справочника
// Bitrix на чтении (документ хранит только employeeId), isDismissed —
// зафиксирован в документе на момент закрытия (см. PRD 1, "Технические
// ограничения"). linesCount — число правил в разбивке для списка, сами
// строки — только в карточке (salaryAccrualResponseSchema).
const salaryAccrualSchema = z.object({
    id: z.string(),
    direction: salesDirectionSchema,
    period: periodSchema,
    employeeId: z.number(),
    employeeName: z.string(),
    departmentId: z.number().nullable(),
    status: salaryAccrualStatusSchema,
    isDismissed: z.boolean(),
    total: z.number(),
    linesCount: z.number(),
    createdAt: z.coerce.date(),
});
export type SalaryAccrual = z.infer<typeof salaryAccrualSchema>;

// Карточка документа — документ вместе со строками по правилам.
const salaryAccrualResponseSchema = salaryAccrualSchema.extend({
    lines: z.array(salaryAccrualLineSchema),
});
export type SalaryAccrualResponse = z.infer<typeof salaryAccrualResponseSchema>;

// GET /v1/{direction}/accounting/salary_accruals?period — список за период.
const listSalaryAccrualsQuerySchema = z.object({
    period: periodSchema,
});
export type ListSalaryAccrualsQuery = z.infer<
    typeof listSalaryAccrualsQuerySchema
>;

const salaryAccrualListResponseSchema = z.object({
    direction: salesDirectionSchema,
    period: periodSchema,
    items: z.array(salaryAccrualSchema),
    total: z.number(),
});
export type SalaryAccrualListResponse = z.infer<
    typeof salaryAccrualListResponseSchema
>;

// Отклонённое повторное открытие периода возвращает перечень документов не
// в DRAFT (см. SalaryAccrualsNotDraftException на бэкенде, metadata.accruals)
// — форма зафиксирована здесь тем же приёмом, что и unapprovedSalesPlanRowSchema.
const salaryAccrualNotDraftRowSchema = z.object({
    id: z.string(),
    employeeId: z.number(),
    status: salaryAccrualStatusSchema,
});
export type SalaryAccrualNotDraftRow = z.infer<
    typeof salaryAccrualNotDraftRowSchema
>;

export {
    salaryAccrualLineStatusSchema,
    salaryAccrualLineSchema,
    salaryAccrualSchema,
    salaryAccrualResponseSchema,
    listSalaryAccrualsQuerySchema,
    salaryAccrualListResponseSchema,
    salaryAccrualNotDraftRowSchema,
};
