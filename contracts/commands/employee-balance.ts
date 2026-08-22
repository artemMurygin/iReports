import { z } from 'zod';
import { periodSchema, salesDirectionSchema } from './sales-plan';
import { salaryAccrualLineSchema } from './salary-accrual';

// Баланс сотрудника (PRD 2 docs/payroll-closing-and-accrual/
// prd-salary-accrual-and-employee-balance.md) — лента движений денег между
// сотрудником и компанией по паре (employeeId, direction). Лента —
// единственный источник истины об остатке: хранимого поля «остаток» нет,
// остаток на чтении — SUM всех движений пары. Суммы — Int в целых рублях,
// та же единица, что у снапшота периода и документа начисления.

// ========================== Тип движения ========================== //

// Перечень заложен целиком сразу (PRD 2: «Перечень типов закладывается
// целиком, включая PAYOUT, чтобы контракт не менялся в PRD 3»):
// SALARY_ACCRUAL/ACCRUAL_ADJUSTMENT — проведение строки начисления (Фаза 6),
// ручные типы и MANUAL_REVERSAL — Фаза 7, PAYOUT — PRD 3.
const balanceTransactionTypeSchema = z.enum([
    'SALARY_ACCRUAL',
    'ACCRUAL_ADJUSTMENT',
    'ADVANCE',
    'EXTRA_ADVANCE',
    'BONUS',
    'SICK_LEAVE',
    'VACATION_PAY',
    'PENALTY',
    'ADJUSTMENT',
    'MANUAL_REVERSAL',
    'PAYOUT',
]);
export type BalanceTransactionType = z.infer<
    typeof balanceTransactionTypeSchema
>;

// ========================== Движение ========================== //

// amount — со знаком (приход положительный, расход отрицательный): остаток
// и итог по выборке — простая сумма. Ссылки на источники — идентификаторы
// (accrualId/lineId/ruleId/reversedTransactionId), а не сериализованные
// копии (PRD 2, «Технические ограничения»); раскрытие начисления до правила
// и источников резолвится на чтении в accrualLine — та же форма строки, что
// в карточке документа начисления. isReversed — признак «сторнировано»
// (на движение ссылается MANUAL_REVERSAL), вычисляется на чтении.
const balanceTransactionSchema = z.object({
    id: z.string(),
    employeeId: z.number(),
    direction: salesDirectionSchema,
    type: balanceTransactionTypeSchema,
    amount: z.number(),
    // Дата движения — может быть задним числом; createdAt — дата создания
    // записи (в ленте видно, что запись создана позже даты движения).
    occurredAt: z.coerce.date(),
    createdAt: z.coerce.date(),
    // Bitrix ID автора (текущего пользователя в бэкенде нет — передаётся
    // явно, как closedBy у периода).
    createdBy: z.number(),
    comment: z.string().nullable(),
    period: periodSchema.nullable(),
    accrualId: z.string().nullable(),
    lineId: z.string().nullable(),
    ruleId: z.string().nullable(),
    reversedTransactionId: z.string().nullable(),
    // Признак «должно отражаться в кассе ERP» — в PRD 2 только хранится и
    // показывается, сама синхронизация — PRD 3.
    erpSyncRequired: z.boolean(),
    isReversed: z.boolean(),
    accrualLine: salaryAccrualLineSchema.nullable(),
});
export type BalanceTransaction = z.infer<typeof balanceTransactionSchema>;

// ========================== Баланс сотрудника ========================== //

// GET /v1/{direction}/accounting/balance/employee/:id?from&to&types —
// фильтры ленты: диапазон дат движения (occurredAt) и типы. Даты — ISO-
// строки, а не z.coerce.date(): DTO из этой схемы идёт в генерацию OpenAPI,
// а zod v4 toJSONSchema() не умеет сериализовать Date (тот же приём, что у
// listDealsQuerySchema в deal.ts). Типы приходят строкой через запятую
// (?types=SALARY_ACCRUAL,ADVANCE) либо повторённым параметром — форма
// (string | string[]) с transform, как queryStringArray там же.
const isoDateStringSchema = z
    .string()
    .min(1)
    .refine(
        (value) => !Number.isNaN(Date.parse(value)),
        'Ожидается дата в формате ISO',
    );
const balanceTransactionTypesFilterSchema = z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .transform((value) => value.flatMap((item) => item.split(',')))
    .pipe(z.array(balanceTransactionTypeSchema));
const getEmployeeBalanceQuerySchema = z.object({
    from: isoDateStringSchema.optional(),
    to: isoDateStringSchema.optional(),
    types: balanceTransactionTypesFilterSchema.optional(),
});
export type GetEmployeeBalanceQuery = z.infer<
    typeof getEmployeeBalanceQuerySchema
>;

// Ответ одного направления: balance — SUM всей ленты пары (без фильтров),
// transactions — движения по фильтрам, selectionTotal — сумма выборки.
// Общий баланс сотрудника по двум направлениям собирается на фронтенде из
// двух ответов (PRD 2, «Технические ограничения») — домены service/shop
// независимы, объединённого эндпоинта нет.
const employeeBalanceResponseSchema = z.object({
    employeeId: z.number(),
    direction: salesDirectionSchema,
    balance: z.number(),
    selectionTotal: z.number(),
    transactions: z.array(balanceTransactionSchema),
});
export type EmployeeBalanceResponse = z.infer<
    typeof employeeBalanceResponseSchema
>;

export {
    balanceTransactionTypeSchema,
    balanceTransactionSchema,
    getEmployeeBalanceQuerySchema,
    employeeBalanceResponseSchema,
};
