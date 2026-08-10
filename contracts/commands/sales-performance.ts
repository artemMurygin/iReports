import { z } from 'zod';
import { periodSchema, salesDirectionSchema, salesPlanSchema } from './sales-plan';

// Факт, прогноз и агрегат SalesPerformance — вход для всех процентных
// зарплатных правил и компактный блок плана в отчётах (Фаза 5, см.
// docs/payroll/plan-payroll-calculation.md и prd-payroll-calculation.md,
// раздел "План и факт продаж"). Ни SalesFact, ни SalesPrognose не
// персистентные сущности — это срез, посчитанный на момент запроса
// (ленивое кэширование результата целиком — Фаза 6), поэтому у них нет
// своего id/createdAt/updatedAt.

// ========================== SalesFact ========================== //

// Считается по данным ERP за период. percentCompletion зависит от плана
// той же строки (turnover / plan.turnover), поэтому SalesFact без плана
// не имеет смысла — он всегда приходит в составе SalesPerformance.
const salesFactSchema = z.object({
    turnover: z.number(),
    margin: z.number(),
    marginPercent: z.number(),
    cost: z.number(),
    quantity: z.number(),
    averageCheck: z.number(),
    percentCompletion: z.number(),
});
export type SalesFactResponse = z.infer<typeof salesFactSchema>;

// ========================== SalesPrognose ========================== //

// Прогноз до конца месяца — линейная экстраполяция факта по прошедшим
// календарным дням месяца (формула зафиксирована на бэкенде в одном месте,
// см. domain/value-objects/sales-prognose.value-object.ts модуля sales).
// Для закрытого периода или периода, целиком лежащего в прошлом, совпадает
// с fact — экстраполировать уже нечего.
const salesPrognoseSchema = z.object({
    turnover: z.number(),
    margin: z.number(),
    marginPercent: z.number(),
    quantity: z.number(),
    percentCompletion: z.number(),
});
export type SalesPrognoseResponse = z.infer<typeof salesPrognoseSchema>;

// ========================== SalesPerformance ========================== //

// Агрегат "план + факт + прогноз" на одну строку (direction, department,
// category, period) — вход для страницы выполнения плана. `plan` —
// полноценный SalesPlan (не урезанный снапшот): UI нужен его статус,
// источник и утверждение, чтобы показать плашку "план не утверждён" и
// заблокировать закрытие периода при неутверждённых строках (Фаза 6).
const salesPerformanceSchema = z.object({
    direction: salesDirectionSchema,
    period: periodSchema,
    department: z.number(),
    category: z.number().nullable(),
    plan: salesPlanSchema,
    fact: salesFactSchema,
    prognose: salesPrognoseSchema,
});
export type SalesPerformanceResponse = z.infer<typeof salesPerformanceSchema>;

// GET /sales/salesPerformance/:period — period в пути, направление в query
// (симметрично GET /sales/plan, см. listSalesPlansQuerySchema).
const listSalesPerformanceQuerySchema = z.object({
    direction: salesDirectionSchema,
});
export type ListSalesPerformanceQuery = z.infer<
    typeof listSalesPerformanceQuerySchema
>;

export {
    salesFactSchema,
    salesPrognoseSchema,
    salesPerformanceSchema,
    listSalesPerformanceQuerySchema,
};
