import type { BalanceTransaction, BalanceTransactionType } from 'ireports-contracts'

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

/** Движение удаляемо вручную (кнопка «Удалить») только когда у него нет ни
 * документа начисления, ни требования синхронизации с кассой ERP — иначе
 * DELETE .../transactions/:id ответит 409. */
export function isDeletable(transaction: BalanceTransaction): boolean {
    return transaction.accrualId === null && !transaction.erpSyncRequired
}
