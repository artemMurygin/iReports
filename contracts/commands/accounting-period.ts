import { z } from 'zod';
import { periodSchema, salesDirectionSchema } from './sales-plan';

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
    category: z.number().nullable(),
});
export type UnapprovedSalesPlanRow = z.infer<
    typeof unapprovedSalesPlanRowSchema
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
    reopenAccountingPeriodRequestSchema,
};
