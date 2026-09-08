import { z } from 'zod';
import { periodSchema, salesDirectionSchema } from './sales-plan';
import { salaryAccrualStatusSchema } from './salary-accrual-status';
import { externalSystemSchema } from './employee-identity';

// Баланс сотрудника (PRD 2 docs/payroll-closing-and-accrual/
// prd-salary-accrual-and-employee-balance.md) — лента движений денег между
// сотрудником и компанией. Баланс ОБЩИЙ по сотруднику: один остаток и одна
// лента на employeeId, без деления на сервис/магазин (Фаза 8b); direction
// движения — лишь необязательный атрибут происхождения (начисление создано
// документом направления, выплата уйдёт в кассу конкретной ERP — PRD 3), на
// остаток и группировку он не влияет. Лента — единственный источник истины
// об остатке: хранимого поля «остаток» нет, остаток на чтении — SUM всех
// движений сотрудника. Суммы — Int в целых рублях, та же единица, что у
// снапшота периода и документа начисления.

// ========================== Тип движения ========================== //

// Перечень заложен целиком сразу (PRD 2: «Перечень типов закладывается
// целиком, включая PAYOUT, чтобы контракт не менялся в PRD 3»):
// SALARY_ACCRUAL/ACCRUAL_ADJUSTMENT — проведение строки начисления (Фаза 6),
// ручные типы — Фаза 7, PAYOUT — PRD 3. Ошибочное ручное движение
// исправляется удалением (DELETE), поэтому отдельного «обратного» типа нет.
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
    'PAYOUT',
]);
export type BalanceTransactionType = z.infer<
    typeof balanceTransactionTypeSchema
>;

// ========================== Движение ========================== //

// amount — со знаком (приход положительный, расход отрицательный): остаток
// и итог по выборке — простая сумма. Ссылки на источники — идентификаторы
// (accrualId/lineId/ruleId), а не сериализованные копии (PRD 2,
// «Технические ограничения»); детализация начисления по правилам и
// источникам живёт в документе начисления — строка ленты не раскрывается,
// у движения начисления есть ссылка на документ (accrualId), по которой UI
// ведёт на карточку документа (Фаза 8b).
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
    // Признак «должно отражаться в кассе ERP» — в PRD 2 только хранится и
    // показывается, сама синхронизация — PRD 3.
    erpSyncRequired: z.boolean(),
    // Связка с документом ERP (PRD 3
    // docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
    // «Критерии готовности»: «Внешний ID документа ERP сохраняется и
    // показывается в ленте баланса») — null для движений без документа ERP
    // (erpSyncRequired: false) и, теоретически, для erpSyncRequired: true
    // движений, если запись ещё не подтянута (не должно происходить при
    // штатной работе — документ создаётся в той же транзакции, что и
    // движение). Только system+externalId — этого достаточно для
    // иконки-ссылки в ленте (P3.3); полная форма ErpCashDocument (erp-cash.ts)
    // не нужна здесь, чтобы не тащить figure kind/amount, дублирующие уже
    // видимые в самом движении.
    erp: z
        .object({
            system: externalSystemSchema,
            externalId: z.string(),
        })
        .nullable(),
});
export type BalanceTransaction = z.infer<typeof balanceTransactionSchema>;

// ========================== Баланс сотрудника ========================== //

// GET /v1/accounting/balance/employee/:id?from&to&types — общий эндпоинт
// без направления в пути (Фаза 8b); фильтры ленты: диапазон дат движения
// (occurredAt) и типы. Даты — ISO-строки, а не z.coerce.date(): DTO из этой
// схемы идёт в генерацию OpenAPI, а zod v4 toJSONSchema() не умеет
// сериализовать Date (тот же приём, что у listDealsQuerySchema в deal.ts).
// Типы приходят строкой через запятую (?types=SALARY_ACCRUAL,ADVANCE) либо
// повторённым параметром — форма (string | string[]) с transform, как
// queryStringArray там же.
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
// cursor/limit — курсорная пагинация ленты «за всё время»
// (docs/employee-settlements-page-redesign, Фаза 7): без периода лента не
// ограничена по месяцу, отдаётся порциями. limit без .default() — тип
// запроса описывает, что можно ОТПРАВИТЬ (клиент вправе не передавать поле
// вовсе), значение по умолчанию (20) и потолок (100 — max() здесь только
// граница валидации, 400 на превышении) применяет бэкенд
// (DEFAULT_BALANCE_TRANSACTIONS_PAGE_LIMIT в balance-transaction.port.ts).
// cursor — id последнего движения предыдущей страницы.
const getEmployeeBalanceQuerySchema = z.object({
    from: isoDateStringSchema.optional(),
    to: isoDateStringSchema.optional(),
    types: balanceTransactionTypesFilterSchema.optional(),
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});
export type GetEmployeeBalanceQuery = z.infer<
    typeof getEmployeeBalanceQuerySchema
>;

// Ответ общего баланса сотрудника (Фаза 8b): balance — SUM всей ленты
// сотрудника независимо от направления движений (без фильтров),
// transactions — движения ТЕКУЩЕЙ СТРАНИЦЫ по фильтрам, selectionTotal —
// сумма ВСЕЙ отфильтрованной выборки (не только текущей страницы, Фаза 7) —
// значение не меняется при уменьшении/увеличении limit. nextCursor/hasMore
// (Фаза 7 docs/employee-settlements-page-redesign) — курсорная пагинация:
// nextCursor — id последнего движения страницы для следующего запроса
// ?cursor=..., null — когда hasMore: false (страница последняя).
const employeeBalanceResponseSchema = z.object({
    employeeId: z.number(),
    balance: z.number(),
    selectionTotal: z.number(),
    transactions: z.array(balanceTransactionSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
});
export type EmployeeBalanceResponse = z.infer<
    typeof employeeBalanceResponseSchema
>;

// ========================== Ручные движения (Фаза 7) ========================== //

// POST /v1/accounting/balance/employee/:id/transactions — ручное движение
// руководителя (PRD 2, таблица типов). Знак определяется типом:
// ADVANCE/EXTRA_ADVANCE/PENALTY — расход, BONUS/SICK_LEAVE/VACATION_PAY —
// приход; клиент передаёт абсолютную величину (> 0), сервер подставляет
// знак. Для ADJUSTMENT знак задаётся явно — amount со знаком (≠ 0).
// SALARY_ACCRUAL/ACCRUAL_ADJUSTMENT рождаются только проведением строки,
// PAYOUT — PRD 3, поэтому в перечне ручных типов их нет.
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

// direction — атрибут происхождения движения: эндпоинт общий (без
// направления в пути), поэтому направление выбирается в форме и передаётся
// в теле; на остаток оно не влияет, но нужно кассе ERP в PRD 3
// (erpSyncRequired). occurredAt — ISO-строка (не z.coerce.date(): DTO идёт
// в генерацию OpenAPI, см. комментарий к getEmployeeBalanceQuerySchema
// выше); дата задним числом разрешена, в т.ч. внутри закрытого месяца —
// снапшот и документы начисления закрытого периода при этом не меняются
// (PRD 2). Обязательность комментария для PENALTY/ADJUSTMENT проверяется и
// здесь (400 на границе HTTP), и в домене. erpSyncRequired в этой итерации
// только хранится и показывается — синхронизация с кассой ERP в PRD 3.
const createBalanceTransactionRequestSchema = z
    .object({
        direction: salesDirectionSchema,
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

// Ошибочное ручное движение без документа ERP исправляется удалением:
// DELETE /v1/accounting/balance/transactions/:id — запись исчезает из
// ленты, остаток пересчитывается (Фаза 8b). PATCH движения не существует;
// движения начисления удаляются только действием «Отменить начисление»
// строки документа, движения с документом ERP — вместе с документом ERP
// (PRD 3). Тела у запроса нет, поэтому отдельная схема не нужна.

// ========================== Сводка по отделу ========================== //

// GET /v1/accounting/balance/department/:id/:period — общие балансы
// сотрудников текущего отдела (отдел — из Bitrix24 на момент запроса, в
// движении не хранится, PRD 2). Суммы со знаком, как в ленте: advances и
// manual у расходов отрицательные. accrued — движения начисления
// (SALARY_ACCRUAL/ACCRUAL_ADJUSTMENT) запрошенного периода (по полю period
// движения) обоих направлений; advances — ADVANCE/EXTRA_ADVANCE с датой
// движения внутри месяца; manual — остальные ручные типы (BONUS/SICK_LEAVE/
// VACATION_PAY/PENALTY/ADJUSTMENT) с датой внутри месяца. balance — SUM
// всей ленты сотрудника, от периода не зависит. accrualStatus — сводный
// статус документов начисления сотрудника за период по обоим направлениям
// (наименее продвинутый: DRAFT < PARTIALLY_ACCRUED < ACCRUED < PAID;
// null — документов нет).
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
    period: periodSchema,
    employees: z.array(departmentEmployeeBalanceSchema),
    totals: departmentBalancesTotalsSchema,
});
export type DepartmentBalancesResponse = z.infer<
    typeof departmentBalancesResponseSchema
>;

// ========================== Сводка взаиморасчётов (все отделы/один отдел) ========================== //

// GET /v1/accounting/balance/summary/:period?departmentId&search — сквозной
// (без направления сервис/магазин) список сотрудников с текущим общим
// остатком (docs/employee-settlements-page-redesign, Фаза 1). В отличие от
// departmentBalancesResponseSchema выше (один КОНКРЕТНЫЙ отдел, колонки
// начислено/авансы/ручные ЗА ПЕРИОД) — departmentId необязателен (без него
// сотрудники ВСЕХ отделов), нет колонок периода: balance — SUM всей ленты
// сотрудника, от периода не зависит; :period в пути тем не менее
// обязателен, тем же приёмом (валидация форматом Period), что и у
// departmentBalancesResponseSchema — задел на будущие фазы, где к сводке
// могут добавиться период-зависимые колонки, без изменения формы пути.
// search — регистронезависимая подстрока по «Имя Фамилия».
const balanceSummaryQuerySchema = z.object({
    departmentId: z.coerce.number().int().positive().optional(),
    search: z.string().trim().min(1).optional(),
});
export type BalanceSummaryQuery = z.infer<typeof balanceSummaryQuerySchema>;

// position/isDismissed — карточка сотрудника (Bitrix24: WORK_POSITION/
// ACTIVE); position — null, пока синхронизация должности не подтянута
// (см. TODO у BitrixEmployee.position, prisma/schema/bitrix.prisma).
// lastMovementAt — max(occurredAt) по сотруднику, null — движений ещё нет.
const balanceSummaryEmployeeSchema = z.object({
    employeeId: z.number(),
    employeeName: z.string(),
    departmentId: z.number(),
    departmentName: z.string(),
    position: z.string().nullable(),
    isDismissed: z.boolean(),
    lastMovementAt: z.coerce.date().nullable(),
    balance: z.number(),
});
export type BalanceSummaryEmployee = z.infer<
    typeof balanceSummaryEmployeeSchema
>;

// KPI-агрегаты по текущей выборке (все отделы либо один отдел, с учётом
// search): balance — общий остаток (сумма строк); toPay — «к выплате
// сотрудникам» (положительные остатки); debt — «долг сотрудников компании»
// (отрицательные остатки, amount — со знаком, как в ленте, т.е. ≤ 0).
const balanceSummaryTotalsSchema = z.object({
    balance: z.number(),
    toPay: z.object({ amount: z.number(), count: z.number() }),
    debt: z.object({ amount: z.number(), count: z.number() }),
});
export type BalanceSummaryTotals = z.infer<typeof balanceSummaryTotalsSchema>;

// departmentId в ответе — null в режиме «все отделы», иначе отражает
// query-фильтр запроса (не привязан к пути, в отличие от
// departmentBalancesResponseSchema.departmentId).
const balanceSummaryResponseSchema = z.object({
    period: periodSchema,
    departmentId: z.number().nullable(),
    employees: z.array(balanceSummaryEmployeeSchema),
    totals: balanceSummaryTotalsSchema,
});
export type BalanceSummaryResponse = z.infer<
    typeof balanceSummaryResponseSchema
>;

export {
    balanceTransactionTypeSchema,
    balanceTransactionSchema,
    // Переиспользуется в salary-payout.ts (Фаза 12 PRD 3) для occurredAt
    // выплаты — та же форма даты, что и у ручного движения, поэтому не
    // дублируем regex/refine третий раз.
    isoDateStringSchema,
    getEmployeeBalanceQuerySchema,
    employeeBalanceResponseSchema,
    manualBalanceTransactionTypeSchema,
    createBalanceTransactionRequestSchema,
    departmentEmployeeBalanceSchema,
    departmentBalancesTotalsSchema,
    departmentBalancesResponseSchema,
    balanceSummaryQuerySchema,
    balanceSummaryEmployeeSchema,
    balanceSummaryTotalsSchema,
    balanceSummaryResponseSchema,
};
