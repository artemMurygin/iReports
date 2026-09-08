import type { BalanceTransaction, BalanceTransactionType, ExternalSystem, SalesDirection } from 'ireports-contracts'

/**
 * Русские названия типов движения для ленты баланса сотрудника (Фаза 10
 * docs/payroll-closing-and-accrual) — перечень типов заложен целиком,
 * включая PAYOUT (PRD 3, ещё не создаётся, но уже приходит с бэкенда), см.
 * balanceTransactionTypeSchema в contracts/commands/employee-balance.ts.
 */
export const transactionTypeLabel: Record<BalanceTransactionType, string> = {
    SALARY_ACCRUAL: 'Начисление',
    ACCRUAL_ADJUSTMENT: 'Корректировка начисления',
    ADVANCE: 'Аванс',
    EXTRA_ADVANCE: 'Доп. аванс',
    BONUS: 'Премия',
    SICK_LEAVE: 'Больничный',
    VACATION_PAY: 'Отпускные',
    PENALTY: 'Штраф',
    ADJUSTMENT: 'Корректировка вручную',
    PAYOUT: 'Выплата',
}

/** «Сервис»/«Магазин» — подпись направления происхождения движения (Pencil `L73YCK`/`JTc29`,
 * docs/employee-settlements-page-redesign, Фаза 5), показывается под типом в каждой строке
 * ленты (`TransactionsLedger`/`TransactionsCardList`) — баланс сотрудника общий (Фаза 8b), но
 * каждое ОТДЕЛЬНОЕ движение несёт направление своего происхождения. Задублирована локально по
 * той же причине, что `ERP_SYSTEM_LABEL` ниже — `DIRECTION_LABEL` в `NewTransactionDrawer.tsx`
 * не переиспользуется (кросс-импорт между features запрещён FSD, frontend/CLAUDE.md). */
export const DIRECTION_LABEL: Record<SalesDirection, string> = {
    service: 'Сервис',
    shop: 'Магазин',
}

/** «RemOnline» / «МойСклад» — подпись системы документа ERP в ленте (P3.3, Фаза 15). Задублирован
 * локально (та же карта есть в `pages/EmployeeIdentity/model/identityLabels.ts`) — кросс-импорт
 * между `features` и `pages` запрещён FSD в эту сторону. */
export const ERP_SYSTEM_LABEL: Record<ExternalSystem, string> = {
    ROAPP: 'RemOnline',
    MOY_SKLAD: 'МойСклад',
}

/** Движение удаляемо через общий `DELETE .../balance/transactions/:id` — для документов
 * начисления (`accrualId != null`) он всегда отклоняет запрос 409, для `PAYOUT` — тоже (см.
 * `BalanceTransactionNotPayoutException`, только `DELETE .../payout/:id` умеет удалять выплату
 * и откатывать документы начисления из `PAID`). Ручные движения удаляемы независимо от
 * `erpSyncRequired` (Фаза 12/15 — раньше, до Фазы 12, ограничение было только «без ERP», это
 * устарело: см. заметку проверки Фазы 12 в docs/payroll-closing-and-accrual). */
export function isDeletable(transaction: BalanceTransaction): boolean {
    return transaction.accrualId === null && transaction.type !== 'PAYOUT'
}

/** Выплата удаляется отдельным путём (`DELETE .../payout/:id`, `ui/DeletePayoutDialog.tsx`
 * этой же фичи, Фаза 6 docs/employee-settlements-page-redesign) — не через общий
 * `isDeletable`/`DeleteTransactionDialog`. */
export function isPayoutTransaction(transaction: BalanceTransaction): boolean {
    return transaction.type === 'PAYOUT'
}
