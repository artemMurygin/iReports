import { z } from 'zod';
import { periodSchema, salesDirectionSchema } from './sales-plan';
import { taskRuleStatusSchema } from './salary-rule';

// Расчётный период направления (Фаза 6, см.
// docs/payroll/plan-payroll-calculation.md и prd-payroll-calculation.md,
// раздел "Расчётный период"). Направление переиспользует salesDirectionSchema
// (sales-plan.ts) — то же значение 'service' | 'shop', отдельного общего
// экспорта между модулями пока нет (см. комментарий в sales-plan.ts про
// directionSalaryReportSchema — та же ситуация здесь).

// ========================== AccountingPeriod ========================== //

const accountingPeriodStatusSchema = z.enum(['OPEN', 'CLOSED']);
export type AccountingPeriodStatus = z.infer<
    typeof accountingPeriodStatusSchema
>;

// Период, для которого ещё нет ни одной записи в БД, трактуется как OPEN —
// закрытие создаёт первую запись (см. AccountingPeriodRepositoryPort).
const accountingPeriodSchema = z.object({
    direction: salesDirectionSchema,
    period: periodSchema,
    status: accountingPeriodStatusSchema,
    closedBy: z.number().nullable(),
    closedAt: z.coerce.date().nullable(),
});
export type AccountingPeriodResponse = z.infer<typeof accountingPeriodSchema>;

// Закрытие — Bitrix ID руководителя, закрывающего период, передаётся явно
// фронтендом (в проекте нет модели прав/резолва "текущего пользователя" вне
// PortalAdminGuard, см. тот же приём в approveSalesPlanRequestSchema).
const closeAccountingPeriodRequestSchema = z.object({
    closedBy: z.number(),
});
export type CloseAccountingPeriodRequest = z.infer<
    typeof closeAccountingPeriodRequestSchema
>;

// Отклонённое закрытие возвращает список неутверждённых строк плана продаж
// (см. UnapprovedSalesPlanRowsException) — форма зафиксирована здесь, чтобы
// фронтенд (Фаза 17) типизировал список без догадок по `metadata: unknown`
// ApiErrorResponse.
const unapprovedSalesPlanRowSchema = z.object({
    id: z.string(),
    department: z.number(),
    category: z.string().nullable(),
});
export type UnapprovedSalesPlanRow = z.infer<
    typeof unapprovedSalesPlanRowSchema
>;

// Правило-задача периода, чья связанная задача Bitrix24 ещё не в статусе
// "Закрыта" (change salary-rule-bitrix-task, spec.md "Список незакрытых
// задач перед закрытием периода") — включая недоступные (задача не может
// быть закрыта, если её вообще не видно). bitrixTaskId/status отсутствуют
// именно у недоступного правила (isUnavailable: true) — та же форма, что и
// bitrixTaskUrl/taskStatus в employeeSalaryReportRuleSchema ниже по файлу.
// Направление — всегда 'service' (единственное направление, где правило
// TaskCompleted сегодня читает Bitrix24, см. design.md/tasks.md раздел 7) —
// поэтому поля direction здесь нет, в отличие от остального closePeriodPreviewSchema.
const unclosedTaskRuleSchema = z.object({
    ruleId: z.string(),
    employeeId: z.number(),
    ruleName: z.string(),
    bitrixTaskId: z.number().optional(),
    status: taskRuleStatusSchema.optional(),
    isUnavailable: z.boolean(),
});

export type UnclosedTaskRule = z.infer<typeof unclosedTaskRuleSchema>;

// Сводка окна подтверждения закрытия (PRD 1 docs/payroll-closing-and-accrual,
// Фаза 2) — GET .../period/:period/close-preview. Считается тем же
// калькулятором строк снапшота, что и само закрытие, поэтому при неизменных
// данных БД значения совпадают с результатом реального закрытия:
// employeesCount — сколько документов начисления будет создано (включая
// нулевые и уволенных), dismissedEmployeesCount — сколько из них уволены,
// totalAmount — фонд оплаты направления в целых рублях (как total снапшота),
// unapprovedPlanRows — строки плана, из-за которых закрытие будет отклонено,
// employeesWithoutHours — сотрудники с правилом PayPerHour без записи часов
// за месяц, unclosedTaskRules — правила-задачи месяца, чьи задачи ещё не
// "Закрыта" (spec.md, задача 6.6/10.4 change salary-rule-bitrix-task; всегда
// [], у направления shop — TaskCompleted там ещё не читает Bitrix24, см.
// tasks.md раздел 7). Сама синхронизация ERP в preview не выполняется — она
// шаг закрытия.
const closePeriodPreviewSchema = z.object({
    direction: salesDirectionSchema,
    period: periodSchema,
    employeesCount: z.number().int().nonnegative(),
    dismissedEmployeesCount: z.number().int().nonnegative(),
    totalAmount: z.number().int(),
    unapprovedPlanRows: z.array(unapprovedSalesPlanRowSchema),
    employeesWithoutHours: z.number().int().nonnegative(),
    unclosedTaskRules: z.array(unclosedTaskRuleSchema),
});
export type ClosePeriodPreviewResponse = z.infer<
    typeof closePeriodPreviewSchema
>;

// Повторное открытие закрытого периода — только с явным подтверждением
// (см. PRD: "требует явного подтверждения и удаляет снапшот"). confirm — не
// булев флаг "да/нет", а буквальный литерал true: запрос без него (или с
// false) отклоняется валидацией тела запроса раньше, чем дойдёт до домена.
const reopenAccountingPeriodRequestSchema = z.object({
    confirm: z.literal(true),
});
export type ReopenAccountingPeriodRequest = z.infer<
    typeof reopenAccountingPeriodRequestSchema
>;

export {
    accountingPeriodStatusSchema,
    accountingPeriodSchema,
    closeAccountingPeriodRequestSchema,
    unapprovedSalesPlanRowSchema,
    unclosedTaskRuleSchema,
    closePeriodPreviewSchema,
    reopenAccountingPeriodRequestSchema,
};
