import { z } from 'zod';
import { salesDirectionSchema } from './sales-plan';
import { balanceTransactionSchema, isoDateStringSchema } from './employee-balance';
import { erpCashDocumentSchema } from './erp-cash';

// Выплата зарплаты (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 12) — SalaryPayout не заводит собственную Prisma-модель: это
// движение баланса типа PAYOUT (сам тип заложен в PRD 2, см.
// balanceTransactionTypeSchema в employee-balance.ts) плюс связанный
// ErpCashDocument (erp-cash.ts). Схемы здесь описывают только форму
// HTTP-контрактов — саму запись выполняют independent-эндпоинты
// /v1/service/accounting/payout* и /v1/shop/accounting/payout* (следующие
// агенты Фазы 12), контракт — общий для обоих направлений, как и
// createBalanceTransactionRequestSchema.

// ========================== Статус выплаты ========================== //

// «Не выплачено» / «Выплачено частично» / «Выплачено» (PRD 3, «Страницы» и
// «Критерии готовности») — производный статус строки сотрудника на
// странице выплаты: NOT_PAID — paid === 0, PARTIALLY_PAID — 0 < paid,
// остаток ещё положительный, PAID — остаток ≤ 0 (тот же критерий, что
// переводит документы начисления в PAID, см. SalaryAccrual.markPaid). НЕ
// путать с SalaryAccrualStatus (salary-accrual-status.ts) — тот про
// документ начисления, этот про сотрудника на экране выплаты в целом.
const payoutStatusSchema = z.enum(['NOT_PAID', 'PARTIALLY_PAID', 'PAID']);
export type PayoutStatus = z.infer<typeof payoutStatusSchema>;

// ========================== Страница выплаты (удалена) ========================== //

// УДАЛЕНО (docs/employee-settlements-page-redesign/
// plan-employee-settlements-page-redesign.md, Фаза 6): payoutPageResponseSchema/
// payoutEmployeeRowSchema/payoutPageTotalsSchema обслуживали только старую
// страницу-отчёт GET /v1/{direction}/accounting/payout/:period («Выплата»),
// заменённую сквозным (без направления) списком «Взаиморасчёты» —
// balanceSummary*Schema в employee-balance.ts (Фаза 1–2 того же плана).
// Эндпоинт (GetPayoutPageHttpController/GetShopPayoutPageHttpController) и
// фронтенд-страница `/payout`, читавшая эти схемы, удалены той же Фазой 6 —
// payoutStatusSchema/PayoutStatus оставлены (использовались только этими
// схемами, но явно не входят в список удаляемых по решению Фазы 6). Не
// путать с createPayoutRequestSchema/payoutResponseSchema/payoutBatch*Schema
// ниже — те описывают само действие «выплатить» (создание движения PAYOUT),
// а не страницу-отчёт, и остаются в проекте как есть (PRD, «Технические
// ограничения»: «не переименовывать сущности, отражающие реальное действие
// «выплата»»).

// ========================== Создание выплаты ========================== //

// POST /v1/{direction}/accounting/payout — тело запроса зафиксировано
// буквально по PRD 3: «{ employeeId, amount, occurredAt, comment,
// createdBy, confirmNegativeBalance? }». amount > 0 всегда (PRD 3:
// «Создаётся на любую сумму amount > 0» — ограничений по остатку нет,
// сумма может превышать остаток, но сама сумма выплаты отрицательной или
// нулевой быть не может, знак расхода подставляет BalanceTransaction.forPayout).
// occurredAt — та же ISO-строка, что и у ручного движения (isoDateStringSchema,
// employee-balance.ts) — не z.coerce.date(), см. комментарий там про
// генерацию OpenAPI. confirmNegativeBalance — явное подтверждение выплаты
// при нулевом/отрицательном остатке или сумме больше остатка (PRD 3,
// «В скоупе»); без флага в такой ситуации запрос отклоняется 409 с текущим
// остатком (см. payoutConfirmationRequiredSchema ниже).
const createPayoutRequestSchema = z.object({
    employeeId: z.number(),
    amount: z.number().int().positive(),
    occurredAt: isoDateStringSchema.optional(),
    comment: z.string().optional(),
    createdBy: z.number(),
    confirmNegativeBalance: z.boolean().optional(),
});
export type CreatePayoutRequest = z.infer<typeof createPayoutRequestSchema>;

// Ответ создания выплаты — движение PAYOUT (уже существующая
// balanceTransactionSchema) вместе со связанным документом ERP
// (erpCashDocumentSchema, erp-cash.ts): «Движение на балансе и документ в
// ERP — одно целое» (PRD 3, «Цель») — ответ показывает оба сразу, чтобы UI
// сразу отрисовал внешний ID без отдельного запроса.
const payoutResponseSchema = z.object({
    transaction: balanceTransactionSchema,
    erpDocument: erpCashDocumentSchema,
});
export type PayoutResponse = z.infer<typeof payoutResponseSchema>;

// Метаданные ошибки «требуется подтверждение» (PRD 3: «запрос отклоняется
// с кодом «требуется подтверждение» и текущим остатком в ответе») — форма
// ExceptionBase.metadata на 409 (см. DomainExceptionFilter,
// ApiErrorResponse.metadata), тот же приём, что salaryAccrualNotDraftRowSchema
// у отклонённого переоткрытия периода: контракт типизирует metadata, чтобы
// фронтенд не полагался на произвольную форму объекта. balanceAfter — то,
// каким станет остаток, если выплату всё же подтвердить (форма показывает
// его без повторного запроса, PRD 3 «Страницы»: «предпросмотр остатка после
// выплаты»).
const payoutConfirmationRequiredSchema = z.object({
    employeeId: z.number(),
    balance: z.number(),
    balanceAfter: z.number(),
});
export type PayoutConfirmationRequired = z.infer<
    typeof payoutConfirmationRequiredSchema
>;

// ========================== Массовая выплата ========================== //

// POST /v1/{direction}/accounting/payout/batch — «Руководитель выбирает
// несколько сотрудников и нажимает «Выплатить выбранным» → по каждому
// создаётся выплата на его остаток» (PRD 3, «День выплаты»): amount не
// передаётся клиентом — сервер берёт остаток каждого сотрудника на момент
// операции («массовая выплата берёт остаток по каждому сотруднику на
// момент операции, а не по данным экрана», «Технические ограничения»).
// confirmNegativeBalance — общий на весь батч: подтверждение уже дано один
// раз в модалке за всех перечисленных в предупреждении сотрудников (PRD 3:
// «сотрудники с нулевым/отрицательным остатком перечислены в подтверждении
// отдельно»), отдельного флага на сотрудника в форме массовой операции нет
// — по аналогии с accruedBy у accrueSalaryAccrualLineRequestSchema, где
// массовое проведение (Фаза 7) тоже берёт один флаг/автора на весь батч, а
// не по строке.
const payoutBatchRequestSchema = z.object({
    employeeIds: z.array(z.number()).min(1),
    occurredAt: isoDateStringSchema.optional(),
    comment: z.string().optional(),
    createdBy: z.number(),
    confirmNegativeBalance: z.boolean().optional(),
});
export type PayoutBatchRequest = z.infer<typeof payoutBatchRequestSchema>;

// Итог по одному сотруднику в батче — PAID (выплата создана), NEEDS_
// CONFIRMATION (нулевой/отрицательный остаток и не было confirmNegativeBalance
// на уровне запроса) или FAILED (ошибка ERP/отсутствие EmployeeIdentity и
// т.п.) — «результат содержит перечень успешных и неудачных» (PRD 3,
// «Критерии готовности»), NEEDS_CONFIRMATION — третья корзина, отдельная от
// FAILED, потому что это не ошибка, а ожидаемая пауза для руководителя (PRD
// 3, «День выплаты»: «сотрудники с нулевым/отрицательным остатком
// перечислены в подтверждении отдельно»).
const payoutBatchOutcomeStatusSchema = z.enum([
    'PAID',
    'NEEDS_CONFIRMATION',
    'FAILED',
]);
export type PayoutBatchOutcomeStatus = z.infer<
    typeof payoutBatchOutcomeStatusSchema
>;

const payoutBatchOutcomeSchema = z.object({
    employeeId: z.number(),
    employeeName: z.string(),
    status: payoutBatchOutcomeStatusSchema,
    // Остаток сотрудника на момент операции (до выплаты) — виден в любом
    // исходе, в т.ч. FAILED/NEEDS_CONFIRMATION, чтобы руководитель понимал,
    // о какой сумме речь, не открывая баланс сотрудника отдельно.
    balance: z.number(),
    // Сумма выплаты — только для PAID (== balance на момент операции);
    // null для NEEDS_CONFIRMATION/FAILED, где выплата не создана.
    amount: z.number().nullable(),
    // Текст ошибки ERP (FAILED) или причины паузы (NEEDS_CONFIRMATION);
    // null для PAID.
    message: z.string().nullable(),
});
export type PayoutBatchOutcome = z.infer<typeof payoutBatchOutcomeSchema>;

const payoutBatchResponseSchema = z.object({
    direction: salesDirectionSchema,
    outcomes: z.array(payoutBatchOutcomeSchema),
    paidCount: z.number(),
    totalPaidAmount: z.number(),
});
export type PayoutBatchResponse = z.infer<typeof payoutBatchResponseSchema>;

export {
    payoutStatusSchema,
    createPayoutRequestSchema,
    payoutResponseSchema,
    payoutConfirmationRequiredSchema,
    payoutBatchRequestSchema,
    payoutBatchOutcomeStatusSchema,
    payoutBatchOutcomeSchema,
    payoutBatchResponseSchema,
};
