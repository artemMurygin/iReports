import { z } from 'zod';
import { periodSchema, salesDirectionSchema } from './sales-plan';
import { salaryAccrualLineSchema } from './salary-accrual';
import { salaryAccrualStatusSchema } from './salary-accrual-status';

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

// ========================== Ручные движения (Фаза 7) ========================== //

// POST /v1/{direction}/accounting/balance/employee/:id/transactions —
// ручное движение руководителя (PRD 2, таблица типов). Знак определяется
// типом: ADVANCE/EXTRA_ADVANCE/PENALTY — расход, BONUS/SICK_LEAVE/
// VACATION_PAY — приход; клиент передаёт абсолютную величину (> 0), сервер
// подставляет знак. Для ADJUSTMENT знак задаётся явно — amount со знаком
// (≠ 0). SALARY_ACCRUAL/ACCRUAL_ADJUSTMENT рождаются только проведением
// строки, MANUAL_REVERSAL — только сторно, PAYOUT — PRD 3, поэтому в
// перечне ручных типов их нет.
const manualBalanceTransactionTypeSchema = z.enum([
    'ADVANCE',
    'EXTRA_ADVANCE',
    'BONUS',
    'SICK_LEAVE',
    'VACATION_PAY',
    'PENALTY',
    'ADJUSTMENT',
]);
export type ManualBalanceTransactionType = z.infer<
    typeof manualBalanceTransactionTypeSchema
>;

// occurredAt — ISO-строка (не z.coerce.date(): DTO идёт в генерацию
// OpenAPI, см. комментарий к getEmployeeBalanceQuerySchema выше); дата
// задним числом разрешена, в т.ч. внутри закрытого месяца — снапшот и
// документы начисления закрытого периода при этом не меняются (PRD 2).
// Обязательность комментария для PENALTY/ADJUSTMENT проверяется и здесь
// (400 на границе HTTP), и в домене. erpSyncRequired в этой итерации
// только хранится и показывается — синхронизация с кассой ERP в PRD 3.
const createBalanceTransactionRequestSchema = z
    .object({
        type: manualBalanceTransactionTypeSchema,
        amount: z.number().int(),
        occurredAt: isoDateStringSchema.optional(),
        comment: z.string().optional(),
        period: periodSchema.optional(),
        createdBy: z.number(),
        erpSyncRequired: z.boolean().optional(),
    })
    .superRefine((value, ctx) => {
        if (value.type === 'ADJUSTMENT') {
            if (value.amount === 0) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['amount'],
                    message:
                        'Сумма корректировки не может быть нулевой — знак задаётся явно',
                });
            }
        } else if (value.amount <= 0) {
            ctx.addIssue({
                code: 'custom',
                path: ['amount'],
                message:
                    'Сумма движения — положительное число: знак подставляется по типу',
            });
        }
        if (
            (value.type === 'PENALTY' || value.type === 'ADJUSTMENT') &&
            (!value.comment || value.comment.trim().length === 0)
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['comment'],
                message:
                    'Для штрафа и корректировки комментарий с причиной обязателен',
            });
        }
    });
export type CreateBalanceTransactionRequest = z.infer<
    typeof createBalanceTransactionRequestSchema
>;

// POST /v1/{direction}/accounting/balance/transactions/:id/reverse —
// сторно ручного движения (MANUAL_REVERSAL): единственный способ исправить
// ручное движение без документа ERP (PATCH/DELETE движения не существует).
// Комментарий обязателен; сторно — всегда точная противоположность
// исходной суммы, поэтому суммы в запросе нет.
const reverseBalanceTransactionRequestSchema = z.object({
    comment: z.string().min(1),
    createdBy: z.number(),
});
export type ReverseBalanceTransactionRequest = z.infer<
    typeof reverseBalanceTransactionRequestSchema
>;

// ========================== Сводка по отделу ========================== //

// GET /v1/{direction}/accounting/balance/department/:id/:period — балансы
// сотрудников текущего отдела (отдел — из Bitrix24 на момент запроса, в
// движении не хранится, PRD 2). Суммы со знаком, как в ленте: advances и
// manual у расходов отрицательные. accrued — движения начисления
// (SALARY_ACCRUAL/ACCRUAL_ADJUSTMENT) запрошенного периода (по полю period
// движения); advances — ADVANCE/EXTRA_ADVANCE с датой движения внутри
// месяца; manual — остальные ручные типы и сторно (BONUS/SICK_LEAVE/
// VACATION_PAY/PENALTY/ADJUSTMENT/MANUAL_REVERSAL) с датой внутри месяца.
// balance — SUM всей ленты пары, от периода не зависит. accrualStatus —
// статус документа начисления сотрудника за период (null — документа нет).
const departmentEmployeeBalanceSchema = z.object({
    employeeId: z.number(),
    employeeName: z.string(),
    balance: z.number(),
    accrued: z.number(),
    advances: z.number(),
    manual: z.number(),
    accrualStatus: salaryAccrualStatusSchema.nullable(),
});
export type DepartmentEmployeeBalance = z.infer<
    typeof departmentEmployeeBalanceSchema
>;

const departmentBalancesTotalsSchema = z.object({
    balance: z.number(),
    accrued: z.number(),
    advances: z.number(),
    manual: z.number(),
});
export type DepartmentBalancesTotals = z.infer<
    typeof departmentBalancesTotalsSchema
>;

// Итог по отделу — сумма строк сотрудников (инвариант проверяется тестом).
const departmentBalancesResponseSchema = z.object({
    departmentId: z.number(),
    direction: salesDirectionSchema,
    period: periodSchema,
    employees: z.array(departmentEmployeeBalanceSchema),
    totals: departmentBalancesTotalsSchema,
});
export type DepartmentBalancesResponse = z.infer<
    typeof departmentBalancesResponseSchema
>;

export {
    balanceTransactionTypeSchema,
    balanceTransactionSchema,
    getEmployeeBalanceQuerySchema,
    employeeBalanceResponseSchema,
    manualBalanceTransactionTypeSchema,
    createBalanceTransactionRequestSchema,
    reverseBalanceTransactionRequestSchema,
    departmentEmployeeBalanceSchema,
    departmentBalancesTotalsSchema,
    departmentBalancesResponseSchema,
};
