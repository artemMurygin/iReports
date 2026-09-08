import { isAxiosError } from 'axios'
import type { AccrueSalaryAccrualDocumentResponse, AccruePeriodSalaryAccrualsResponse } from 'ireports-contracts'

/**
 * Массовое проведение документов (Фаза 9 docs/payroll-closing-and-accrual, P2.1): чистые
 * производные, вынесенные из хуков/компонентов так же, как `deriveCloseDialogState`
 * (features/AccountingPeriod) — компонент/хук страницы только читает готовый результат.
 *
 * «Начислить все документы месяца» — один запрос `accruePeriod`, ответ уже несёт агрегат
 * (`accrueBatchFromPeriodResponse`). «Начислить выбранным» технически не имеет отдельного
 * batch-эндпоинта — вызывается `accrueDocument` параллельно на каждый выбранный документ
 * (`Promise.allSettled`), а агрегат строится здесь вручную (`aggregateAccrueBatch`).
 */

/** Одна строка ошибки результата — ФИО, правило, текст (P2.1). Тот же набор полей, что у
 * `SalaryAccrualLineFailure`, плюс синтетическая запись для документа, чей запрос упал
 * целиком (сеть/5xx) — у такой записи нет конкретного правила. */
export type AccrueFailureItem = {
    accrualId: string
    employeeName: string
    ruleName: string
    message: string
}

export type AccrueBatchResult = {
    /** Документов, проведённых полностью (без единой ошибки строки) этой операцией. */
    accruedCount: number
    totalCount: number
    /** Сумма проведённых документов (`accrual.total` для каждого без ошибок / из ответа периода). */
    accruedAmount: number
    failures: AccrueFailureItem[]
}

/**
 * Агрегирует результаты параллельных вызовов `accrueDocument` («Начислить выбранным») —
 * `items` и `settled` должны идти в одном порядке (тот же массив id, что передавался в
 * `Promise.allSettled`). Отклонённый промис (сетевая ошибка/5xx, не 200 с частичными
 * `failures`) превращается в одну синтетическую запись ошибки на весь документ.
 */
export function aggregateAccrueBatch(
    settled: PromiseSettledResult<AccrueSalaryAccrualDocumentResponse>[],
    items: { id: string; employeeName: string }[],
): AccrueBatchResult {
    let accruedCount = 0
    let accruedAmount = 0
    const failures: AccrueFailureItem[] = []

    settled.forEach((outcome, index) => {
        const item = items[index]
        if (item === undefined) return

        if (outcome.status === 'rejected') {
            failures.push({
                accrualId: item.id,
                employeeName: item.employeeName,
                ruleName: '—',
                message: readAccrueErrorMessage(outcome.reason),
            })
            return
        }

        const { accrual, failures: lineFailures } = outcome.value
        if (lineFailures.length === 0) {
            accruedCount += 1
            accruedAmount += accrual.total
        }
        failures.push(
            ...lineFailures.map((failure): AccrueFailureItem => ({
                accrualId: failure.accrualId,
                employeeName: failure.employeeName,
                ruleName: failure.ruleName,
                message: failure.message,
            })),
        )
    })

    return { accruedCount, totalCount: items.length, accruedAmount, failures }
}

/** Ответ «Начислить все документы месяца» уже несёт готовый агрегат — просто переносим поля. */
export function accrueBatchFromPeriodResponse(response: AccruePeriodSalaryAccrualsResponse): AccrueBatchResult {
    return {
        accruedCount: response.accruedDocumentsCount,
        totalCount: response.documentsCount,
        accruedAmount: response.accruedAmount,
        failures: response.failures,
    }
}

/** Складывает результат повтора (`retryFailures`) поверх предыдущего: успевшие раньше
 * документы остаются посчитанными, `failures`/`totalCount` берутся из повторного вызова
 * (обновлённый перечень тех, что не удались и на этот раз). */
export function mergeAccrueBatchRetry(previous: AccrueBatchResult, retry: AccrueBatchResult): AccrueBatchResult {
    return {
        accruedCount: previous.accruedCount + retry.accruedCount,
        totalCount: previous.totalCount,
        accruedAmount: previous.accruedAmount + retry.accruedAmount,
        failures: retry.failures,
    }
}

/** Текст ошибки одного `accrueDocument` — та же выемка `response.data.message`, что
 * `classifyClosePeriodError` (features/AccountingPeriod/model/closePeriodErrors.ts), без
 * классификации по видам (тут достаточно человекочитаемой строки в список ошибок). */
export function readAccrueErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const body = error.response?.data as { message?: unknown } | undefined
        if (typeof body?.message === 'string' && body.message.trim() !== '') return body.message
        return error.message
    }
    return String(error)
}
