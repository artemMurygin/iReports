import { isAxiosError } from 'axios'
import type { SalaryAccrualNotDraftRow, UnapprovedSalesPlanRow } from 'ireports-contracts'

/**
 * Классификация ошибок закрытия/переоткрытия периода. Бэкенд отдаёт все конфликты
 * закрытия одним статусом 409/CONFLICT (ErpSyncFailedException /
 * PeriodNotExpiredException / AccountingPeriodClosedException /
 * UnapprovedSalesPlanRowsException — см. заметки Фазы 2
 * docs/payroll-closing-and-accrual), различимы они только по `metadata` и тексту
 * `message` тела `ApiErrorResponse` — поэтому разбор собран здесь в один
 * дискриминированный union, а не размазан if-ами по компонентам диалога.
 * Формы `metadata.rows` / `metadata.accruals` зафиксированы Zod-схемами в
 * `ireports-contracts` (unapprovedSalesPlanRowSchema / salaryAccrualNotDraftRowSchema).
 */

export type ClosePeriodError =
    /** Неявная синхронизация ERP не удалась (или бэкенд недоступен — 5xx/сеть): период открыт, можно повторить. */
    | { kind: 'erp-sync'; message: string; reason: string | null }
    /** В плане продаж месяца есть неутверждённые строки — закрытие заблокировано. */
    | { kind: 'unapproved-plan'; rows: UnapprovedSalesPlanRow[] }
    /** Месяц ещё не закончился (кнопку дизейблит UI, но гонка с полуночью возможна). */
    | { kind: 'not-expired'; message: string }
    /** Период уже закрыт (например, вторым руководителем параллельно). */
    | { kind: 'already-closed'; message: string; closedBy: number | null; closedAt: string | null }
    | { kind: 'unknown'; message: string }

export type ReopenPeriodError =
    /** Есть документы начисления не в «Черновике» — переоткрытие запрещено, перечень в `accruals`. */
    | { kind: 'not-draft'; accruals: SalaryAccrualNotDraftRow[] }
    | { kind: 'unknown'; message: string }

type ErrorBody = {
    message?: unknown
    metadata?: {
        rows?: unknown
        accruals?: unknown
        reason?: unknown
        closedBy?: unknown
        closedAt?: unknown
    }
}

function readBody(error: unknown): { status: number | null; message: string; body: ErrorBody } {
    if (isAxiosError(error)) {
        const body = (error.response?.data ?? {}) as ErrorBody
        const message = typeof body.message === 'string' && body.message.trim() !== '' ? body.message : error.message
        return { status: error.response?.status ?? null, message, body }
    }
    return { status: null, message: String(error), body: {} }
}

export function classifyClosePeriodError(error: unknown): ClosePeriodError {
    const { status, message, body } = readBody(error)
    const metadata = body.metadata ?? {}

    if (Array.isArray(metadata.rows)) {
        return { kind: 'unapproved-plan', rows: metadata.rows as UnapprovedSalesPlanRow[] }
    }

    // ErpSyncFailedException — единственный 409 закрытия с `metadata.reason`; его текст
    // фиксирован PRD («Не удалось получить данные из ERP…»). Сюда же — 502/503/504 и
    // сетевые ошибки без ответа: с точки зрения пользователя это то же «повторите позже».
    const isErpMessage = message.includes('из ERP')
    const isUnavailable = status === null || status === 502 || status === 503 || status === 504
    if (isErpMessage || (isAxiosError(error) && isUnavailable)) {
        const reason = typeof metadata.reason === 'string' && metadata.reason !== '' ? metadata.reason : null
        return { kind: 'erp-sync', message, reason }
    }

    if (message.includes('не закончился')) {
        return { kind: 'not-expired', message }
    }

    if ('closedAt' in metadata || 'closedBy' in metadata) {
        return {
            kind: 'already-closed',
            message,
            closedBy: typeof metadata.closedBy === 'number' ? metadata.closedBy : null,
            closedAt: typeof metadata.closedAt === 'string' ? metadata.closedAt : null,
        }
    }

    return { kind: 'unknown', message }
}

export function classifyReopenPeriodError(error: unknown): ReopenPeriodError {
    const { message, body } = readBody(error)
    const metadata = body.metadata ?? {}

    if (Array.isArray(metadata.accruals)) {
        return { kind: 'not-draft', accruals: metadata.accruals as SalaryAccrualNotDraftRow[] }
    }

    return { kind: 'unknown', message }
}
