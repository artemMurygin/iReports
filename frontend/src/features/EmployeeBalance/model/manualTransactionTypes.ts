import type { ManualBalanceTransactionType } from 'ireports-contracts'

/**
 * Типы ручных движений для drawer «Добавить движение» (Фаза 10
 * docs/payroll-closing-and-accrual), разбитые на приход/расход по знаку,
 * который подставляет сервер (см. createBalanceTransactionRequestSchema в
 * contracts/commands/employee-balance.ts): ADJUSTMENT — со знаком, выбирается
 * пользователем явно, поэтому присутствует в обоих списках.
 *
 * `PAYOUT` (Фаза 6 docs/employee-settlements-page-redesign) — единственный
 * пункт списка расхода, который НЕ входит в `ManualBalanceTransactionType`
 * (см. WHY в contracts/commands/employee-balance.ts: PAYOUT создаётся
 * отдельным эндпоинтом `POST .../payout`, а не общим `POST .../transactions`)
 * — отсюда более широкий тип элемента `OutcomeTransactionType`. Выбор этого
 * пункта в `NewTransactionDrawer` переключает форму на реальный вызов
 * `create-payout` (см. WHY в `NewTransactionDrawer.tsx`) — старая отдельная
 * кнопка «Выплатить»/`PayoutDrawer` (`features/Payout`, теперь удалена)
 * замещена этим пунктом единого drawer'а «Добавить расход».
 */
export type OutcomeTransactionType = ManualBalanceTransactionType | 'PAYOUT'

export const INCOME_TRANSACTION_TYPES: { value: ManualBalanceTransactionType; label: string }[] = [
    { value: 'BONUS', label: 'Премия' },
    { value: 'SICK_LEAVE', label: 'Больничный' },
    { value: 'VACATION_PAY', label: 'Отпускные' },
    { value: 'ADJUSTMENT', label: 'Корректировка вручную' },
]

export const OUTCOME_TRANSACTION_TYPES: { value: OutcomeTransactionType; label: string }[] = [
    { value: 'PAYOUT', label: 'Выплата' },
    { value: 'ADVANCE', label: 'Аванс' },
    { value: 'EXTRA_ADVANCE', label: 'Доп. аванс' },
    { value: 'PENALTY', label: 'Штраф' },
    { value: 'ADJUSTMENT', label: 'Корректировка вручную' },
]
