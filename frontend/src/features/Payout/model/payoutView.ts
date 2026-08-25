import { isAxiosError } from 'axios'
import type { PayoutBatchOutcome, PayoutConfirmationRequired, PayoutEmployeeRow, PayoutStatus } from 'ireports-contracts'

/** Русские названия статуса выплаты сотрудника (P3.1: «Не выплачено» — серый, «Выплачено
 * частично» — жёлтый, «Выплачено» — зелёный). */
export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
    NOT_PAID: 'Не выплачено',
    PARTIALLY_PAID: 'Выплачено частично',
    PAID: 'Выплачено',
}

/** «Все» / «Только невыплаченные» / «Частично» — фильтр-чипы P3.1. НЕ совпадает 1-в-1 с
 * `PayoutStatus`: «Только невыплаченные» относится к `NOT_PAID`, «Частично» — к
 * `PARTIALLY_PAID`; выплаченных отдельным чипом не фильтруют (их видно по бейджу в таблице). */
export type PayoutStatusFilter = 'ALL' | 'NOT_PAID' | 'PARTIALLY_PAID'
export const PAYOUT_STATUS_FILTERS: PayoutStatusFilter[] = ['ALL', 'NOT_PAID', 'PARTIALLY_PAID']
export const PAYOUT_STATUS_FILTER_LABEL: Record<PayoutStatusFilter, string> = {
    ALL: 'Все',
    NOT_PAID: 'Только невыплаченные',
    PARTIALLY_PAID: 'Частично',
}

/** Инициалы ФИО для аватара («Иван Петров» -> «ИП») — та же логика, что
 * `employeeInitials` в features/SalaryAccruals/model/accrualView.ts, задублирована здесь
 * намеренно (кросс-импорт между features запрещён). */
export function employeeInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    return parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
}

export function filterPayoutRows(
    rows: PayoutEmployeeRow[],
    filter: PayoutStatusFilter,
    search: string,
): PayoutEmployeeRow[] {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
        if (filter === 'NOT_PAID' && row.payoutStatus !== 'NOT_PAID') return false
        if (filter === 'PARTIALLY_PAID' && row.payoutStatus !== 'PARTIALLY_PAID') return false
        if (query !== '' && !row.name.toLowerCase().includes(query)) return false
        return true
    })
}

export function countByPayoutStatusFilter(rows: PayoutEmployeeRow[]): Record<PayoutStatusFilter, number> {
    return {
        ALL: rows.length,
        NOT_PAID: rows.filter((row) => row.payoutStatus === 'NOT_PAID').length,
        PARTIALLY_PAID: rows.filter((row) => row.payoutStatus === 'PARTIALLY_PAID').length,
    }
}

/** 400/409 с человекочитаемым `message` в теле (тот же приём, что `readAccrueErrorMessage` в
 * features/SalaryAccruals/model/accrueBatch.ts и `readCreateTransactionErrorMessage` в
 * features/EmployeeBalance/ui/NewTransactionDrawer.tsx). */
export function readPayoutErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const body = error.response?.data as { message?: unknown } | undefined
        if (typeof body?.message === 'string' && body.message.trim() !== '') return body.message
    }
    return 'Не удалось создать выплату, попробуйте ещё раз'
}

/** 409 `PayoutConfirmationRequiredException` — извлекает `metadata` тела ошибки
 * (`{ employeeId, balance, balanceAfter }`), см. `payoutConfirmationRequiredSchema` в
 * contracts/commands/salary-payout.ts. `null`, если это не тот случай (другая ошибка). */
export function readPayoutConfirmationRequired(error: unknown): PayoutConfirmationRequired | null {
    if (!isAxiosError(error) || error.response?.status !== 409) return null
    const body = error.response.data as { metadata?: unknown } | undefined
    const metadata = body?.metadata as Partial<PayoutConfirmationRequired> | undefined
    if (
        metadata === undefined ||
        typeof metadata.employeeId !== 'number' ||
        typeof metadata.balance !== 'number' ||
        typeof metadata.balanceAfter !== 'number'
    ) {
        return null
    }
    return { employeeId: metadata.employeeId, balance: metadata.balance, balanceAfter: metadata.balanceAfter }
}

/** «сотрудник» / «сотрудника» / «сотрудников» — родительный падеж числительного для счётчиков
 * (Selection Bar, confirm/result модалки), тот же приём, что `pluralizeDocuments` в
 * features/SalaryAccruals/model/accrualView.ts. */
export function pluralizeEmployees(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100
    if (mod10 === 1 && mod100 !== 11) return 'сотрудника'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'сотрудников'
    return 'сотрудников'
}

/** Одна строка результата массовой выплаты, читаемая `PayoutResultModal`/логикой повтора — тот
 * же приём, что `AccrueFailureItem` (features/SalaryAccruals/model/accrueBatch.ts), но без
 * отдельного "успешного" счётчика: успех уже виден в `PayoutBatchResponse.paidCount`. */
export type PayoutRetryableOutcome = PayoutBatchOutcome & { status: 'FAILED' | 'NEEDS_CONFIRMATION' }

export function retryableOutcomes(outcomes: PayoutBatchOutcome[]): PayoutRetryableOutcome[] {
    return outcomes.filter(
        (outcome): outcome is PayoutRetryableOutcome => outcome.status === 'FAILED' || outcome.status === 'NEEDS_CONFIRMATION',
    )
}
