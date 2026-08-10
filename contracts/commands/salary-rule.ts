import { z } from 'zod';

// ========================== Роль правила ========================== //

// Роль, за которую платит правило — общее поле рядом с type/name, а не
// часть config (см. docs/payroll/prd-payroll-calculation.md, раздел 2).
// Перечень пока ограничен ролями сервиса, зафиксированными в PRD; роли
// магазина (ONLINE_PURCHASER / OFFLINE_PURCHASER) добавляются вместе с
// направлением shop (Фаза 12).
const targetRoleSchema = z.enum([
    'ENGINEER',
    'ONLINE_MANAGER',
    'OFFLINE_MANAGER',
    'ORDER_MANAGER',
    'CREATED_BY',
    'CLOSED_BY',
]);

export type TargetRole = z.infer<typeof targetRoleSchema>;

// ========================== Почасовая ставка ========================== //

const payPerHourSalaryConfigSchema = z.object({
    hours: z.number().optional(),
    price: z.number(),
    total: z.number().optional(),
});

const payPerHourSalaryRuleSchema = z.object({
    type: z.literal('PayPerHour'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: payPerHourSalaryConfigSchema,
});

// ========================== За выполненную услугу ========================== //

const serviceCompletedSalaryConfigSchema = z.object({
    award: z.union([
        z.object({ type: z.literal('Fixed'), price: z.number() }),
        z.object({ type: z.literal('ServiceFixed') }),
        z.object({ type: z.literal('ServicePercent'), percent: z.number() }),
    ]),
});

const serviceCompletedSalaryRuleSchema = z.object({
    type: z.literal('ServiceCompleted'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: serviceCompletedSalaryConfigSchema,
});

// ========================== За оплаченный заказ ========================== //

const percentBorderSchema = z.object({
    name: z.string(),
    fromPlanPercent: z.number(),
    multiplier: z.number(),
    mode: z.enum(['FIX', 'LINEAR']),
});

const orderPayedSalaryConfigSchema = z.object({
    award: z.union([
        z.object({ type: z.literal('Fixed'), price: z.number() }),
        z.object({
            type: z.literal('FixedPercent'),
            percent: z.number(),
            salaryBasis: z.enum(['REVENUE', 'MARGIN', 'SALARY_MINUS_ENGINEER_SALARY'],)
        }),
        z.object({
            type: z.literal('FloatPercent'),
            basePercent: z.number(),
            salaryBasis: z.enum(['REVENUE', 'MARGIN', 'SALARY_MINUS_ENGINEER_SALARY']),
            percentBorders: z.tuple([
                percentBorderSchema,
                percentBorderSchema,
                percentBorderSchema,
            ]),
        }),
    ]),
})

const orderPayedSalaryRuleSchema = z.object({
    type: z.literal('OrderPayed'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: orderPayedSalaryConfigSchema
})

// ========================== За выполненную задачу ========================== //

const taskCompletedSalaryConfigSchema = z.object({
    award: z.union([
        z.object({ type: z.literal('Fixed'), price: z.number() }),
        z.object({ type: z.literal('FloatPercent') })
    ]),
});

const taskCompletedSalaryRuleSchema = z.object({
    type: z.literal('TaskCompleted'),
    name: z.string(),
    targetRole: targetRoleSchema,
    config: taskCompletedSalaryConfigSchema
})


const salaryRuleRequestSchema = z.discriminatedUnion('type', [
    payPerHourSalaryRuleSchema,
    serviceCompletedSalaryRuleSchema,
    orderPayedSalaryRuleSchema,
]);

export type SalaryRuleRequest = z.infer<typeof salaryRuleRequestSchema>;

// ========================== Строка расчёта ========================== //

// Результат calculate() одного правила за один проход (один режим — FACT
// либо PROGNOSE) — не число, а строка расчёта: правило, база начисления,
// количество, ставка, сумма, ссылки на источники (заказы/позиции/продажи),
// на которых она получена. Форма едина для service и shop (зеркало
// src/shared/domain/calculation-line.ts на бэкенде — там это внутренний
// доменный тип, здесь — его сериализуемая форма).
const calculationSourceRefSchema = z.object({
    type: z.string(),
    id: z.union([z.string(), z.number()]),
});

const calculationLineSchema = z.object({
    ruleId: z.string(),
    salaryBasis: z.string().optional(),
    quantity: z.number().optional(),
    rate: z.number().optional(),
    amount: z.number(),
    sources: z.array(calculationSourceRefSchema),
});

export type CalculationLineResponse = z.infer<typeof calculationLineSchema>;

// ========================== Отчёт по зарплате сотрудника ========================== //

// Пара «факт / прогноз» — отчёт всегда считает calculate() дважды (режимы
// FACT и PROGNOSE) и сводит строки по ruleId; отдельной ветки под прогноз
// нет (см. PRD, раздел 6).
const factPrognoseAmountSchema = z.object({
    fact: z.number(),
    prognose: z.number(),
});

const salesPerformanceSummarySchema = z.object({
    department: z.number(),
    category: z.number().nullable(),
    plan: z.object({ turnover: z.number(), margin: z.number() }),
    fact: z.object({ turnover: z.number(), margin: z.number() }),
    prognose: z.object({ turnover: z.number(), margin: z.number() }),
    percentCompletion: z.number(),
});

// Разбивка по правилу в отчёте — это calculationLineSchema, сведённый по
// парам FACT/PROGNOSE, плюс атрибуты правила (type/name/targetRole), нужные
// UI для отображения без дополнительных запросов.
const employeeSalaryReportRuleSchema = z.object({
    ruleId: z.string(),
    type: z.string(),
    name: z.string(),
    targetRole: targetRoleSchema,
    amount: factPrognoseAmountSchema,
    appliedPercent: z.number().optional(),
    sources: z.array(calculationSourceRefSchema),
});

const directionSalaryReportSchema = z.object({
    direction: z.enum(['service', 'shop']),
    total: factPrognoseAmountSchema,
    rules: z.array(employeeSalaryReportRuleSchema),
    // Заполняется начиная с Фазы 5 (модуль sales/SalesPerformance) — до этого
    // момента у направления ещё нет ни плана, ни факта продаж.
    salesPerformance: salesPerformanceSummarySchema.nullable(),
    isPlanApproved: z.boolean(),
});

const employeeSalaryReportResponseSchema = z.object({
    period: z.string(),
    isClosed: z.boolean(),
    directions: z.array(directionSalaryReportSchema),
    grandTotal: factPrognoseAmountSchema,
});

export type EmployeeSalaryReportResponse = z.infer<
    typeof employeeSalaryReportResponseSchema
>;

export {
    salaryRuleRequestSchema,
    payPerHourSalaryConfigSchema,
    serviceCompletedSalaryConfigSchema,
    targetRoleSchema,
    calculationLineSchema,
    employeeSalaryReportResponseSchema,
};