import type { ManualBalanceTransactionType } from 'ireports-contracts'

/**
 * Типы ручных движений для drawer «Добавить движение» (Фаза 10
 * docs/payroll-closing-and-accrual), разбитые на приход/расход по знаку,
 * который подставляет сервер (см. createBalanceTransactionRequestSchema в
 * contracts/commands/employee-balance.ts): ADJUSTMENT — со знаком, выбирается
 * пользователем явно, поэтому присутствует в обоих списках.
 */

export const INCOME_TRANSACTION_TYPES: { value: ManualBalanceTransactionType; label: string }[] = [
    { value: 'BONUS', label: 'Премия' },
    { value: 'SICK_LEAVE', label: 'Больничный' },
    { value: 'VACATION_PAY', label: 'Отпускные' },
    { value: 'ADJUSTMENT', label: 'Корректировка вручную' },
]

export const OUTCOME_TRANSACTION_TYPES: { value: ManualBalanceTransactionType; label: string }[] = [
    { value: 'ADVANCE', label: 'Аванс' },
    { value: 'EXTRA_ADVANCE', label: 'Доп. аванс' },
    { value: 'PENALTY', label: 'Штраф' },
    { value: 'ADJUSTMENT', label: 'Корректировка вручную' },
]
