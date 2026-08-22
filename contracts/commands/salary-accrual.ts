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
// момент закрытия, amount — действующая сумма строки (корректировка PRD 2
// меняет только amount). adjustmentComment — комментарий последней
// корректировки (null, если строка не корректировалась): UI показывает его
// рядом с зачёркнутой исходной суммой, а проведение скорректированной
// строки кладёт его в движение ACCRUAL_ADJUSTMENT (см. employee-balance.ts).
const salaryAccrualLineSchema = calculationLineSchema.extend({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    targetRole: targetRoleSchema,
    originalAmount: z.number(),
    status: salaryAccrualLineStatusSchema,
    adjustmentComment: z.string().nullable(),
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
    // Число уже проведённых на баланс строк (PRD 2, Фаза 6) — точный
    // прогресс «N из M» доступен прямо в списке, без загрузки карточки
    // (см. deriveListProgress на фронтенде — до этого поля прогресс
    // выводился из статуса документа).
    accruedLinesCount: z.number(),
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

// ========================== Действия над строкой (PRD 2, Фаза 6) ========================== //

// POST .../salary_accruals/:id/lines/:lineId/accrue — проведение строки на
// баланс. accruedBy — Bitrix ID руководителя, передаётся явно фронтендом
// (текущего пользователя в бэкенде нет — тот же приём, что closedBy у
// периода и approvedBy у плана продаж). Он же станет createdBy движений
// баланса, порождённых проведением.
const accrueSalaryAccrualLineRequestSchema = z.object({
    accruedBy: z.number(),
});
export type AccrueSalaryAccrualLineRequest = z.infer<
    typeof accrueSalaryAccrualLineRequestSchema
>;

// PATCH .../salary_accruals/:id/lines/:lineId — корректировка строки до
// проведения (только DRAFT): новая действующая сумма + обязательный
// комментарий + автор. originalAmount не меняется — исходный расчёт всегда
// виден рядом со скорректированной суммой.
const adjustSalaryAccrualLineRequestSchema = z.object({
    amount: z.number().int(),
    comment: z.string().min(1),
    adjustedBy: z.number(),
});
export type AdjustSalaryAccrualLineRequest = z.infer<
    typeof adjustSalaryAccrualLineRequestSchema
>;

// ========================== Массовое проведение (Фаза 7) ========================== //

// Строка перечня неудачных при массовом проведении («Начислить всё» /
// «Начислить все документы месяца», PRD 2): каждая строка либо проведена
// вместе со своим движением, либо попала сюда — частичный сбой не оставляет
// половину строк проведёнными без записи об ошибке. ФИО и название правила
// — для модалки результата (P2.1: «ФИО, правило, текст ошибки»).
const salaryAccrualLineFailureSchema = z.object({
    accrualId: z.string(),
    employeeId: z.number(),
    employeeName: z.string(),
    lineId: z.string(),
    ruleName: z.string(),
    message: z.string(),
});
export type SalaryAccrualLineFailure = z.infer<
    typeof salaryAccrualLineFailureSchema
>;

// POST .../salary_accruals/:id/accrue — «Начислить всё» по документу:
// обновлённая карточка + перечень строк, которые провести не удалось.
// Тело запроса — accrueSalaryAccrualLineRequestSchema ({ accruedBy }).
const accrueSalaryAccrualDocumentResponseSchema = z.object({
    accrual: salaryAccrualResponseSchema,
    failures: z.array(salaryAccrualLineFailureSchema),
});
export type AccrueSalaryAccrualDocumentResponse = z.infer<
    typeof accrueSalaryAccrualDocumentResponseSchema
>;

// POST .../salary_accruals/accrue?period — «Начислить все документы
// месяца»: статистика для модалки результата («Начислено N из M документов
// на X ₽») + перечень ошибок. documentsCount — документов направления за
// период; accruedDocumentsCount — полностью проведённых после операции
// (ACCRUED или PAID); accruedLinesCount/accruedAmount — строки, проведённые
// именно этой операцией, и их действующая сумма.
const accruePeriodSalaryAccrualsResponseSchema = z.object({
    direction: salesDirectionSchema,
    period: periodSchema,
    documentsCount: z.number(),
    accruedDocumentsCount: z.number(),
    accruedLinesCount: z.number(),
    accruedAmount: z.number(),
    failures: z.array(salaryAccrualLineFailureSchema),
});
export type AccruePeriodSalaryAccrualsResponse = z.infer<
    typeof accruePeriodSalaryAccrualsResponseSchema
>;

export {
    salaryAccrualLineStatusSchema,
    salaryAccrualLineSchema,
    salaryAccrualSchema,
    salaryAccrualResponseSchema,
    listSalaryAccrualsQuerySchema,
    salaryAccrualListResponseSchema,
    salaryAccrualNotDraftRowSchema,
    accrueSalaryAccrualLineRequestSchema,
    adjustSalaryAccrualLineRequestSchema,
    salaryAccrualLineFailureSchema,
    accrueSalaryAccrualDocumentResponseSchema,
    accruePeriodSalaryAccrualsResponseSchema,
};
