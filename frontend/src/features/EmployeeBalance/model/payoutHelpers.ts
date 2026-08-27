import { isAxiosError } from 'axios'
import type { ErpCashConfigResponse, PayoutConfirmationRequired, SalesDirection } from 'ireports-contracts'

/**
 * Хелперы «Выплаты» (тип `PAYOUT` в `NewTransactionDrawer`, Фаза 6
 * docs/employee-settlements-page-redesign) — перенесены буквально из бывшей
 * `features/Payout/model/payoutView.ts` (удалена той же фазой: страница
 * `/payout` и её отдельный `PayoutDrawer` ушли, но сама логика чтения
 * 409-подтверждения/ошибки ERP осталась нужна — теперь общему drawer'у
 * добавления движения).
 */

/** 400/409 с человекочитаемым `message` в теле — тот же приём, что
 * `readCreateTransactionErrorMessage` в `NewTransactionDrawer.tsx`. */
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

/** «RemOnline · касса Основная» / «МойСклад · статья «Зарплата»» / «Касса не
 * настроена» / «Загрузка кассы…» — подпись документа ERP, который создаст
 * выплата (P3.1: подпись read-only, без выбора). `data` — `undefined`, пока
 * запрос `getErpCashConfig` ещё не ответил. Перенесено из
 * `pages/EmployeeBalance/model/useEmployeeBalancePage.ts` (была частью
 * старого отдельного `PayoutDrawer`-флоу). */
export function resolvePayoutCashLabel(direction: SalesDirection, data: ErpCashConfigResponse | undefined): string {
    if (data === undefined) return 'Загрузка кассы…'
    if (direction === 'service') {
        return data.roappCashboxId !== null ? 'RemOnline · касса Основная' : 'Касса RemOnline не настроена'
    }
    return data.moySkladExpenseItemId !== null && data.organizationId !== null
        ? 'МойСклад · статья «Зарплата»'
        : 'Касса МойСклад не настроена'
}
