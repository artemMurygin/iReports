import type { BalanceTransaction } from 'ireports-contracts'

import { DIRECTION_LABEL, transactionTypeLabel } from '@/features/EmployeeBalance'
import { formatShortDate } from '@/shared/lib/format.ts'

/** Дублирует `escapeCsvField`/`buildEmployeeSettlementsCsv` из `pages/EmployeeSettlements`
 * (кросс-импорт между `pages` запрещён FSD, frontend/CLAUDE.md) — тот же приём CSV (разделитель
 * `;`, BOM в начале строки для кириллицы в Excel). */
function escapeCsvField(value: string): string {
    return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * «Выгрузить ленту» (Pencil `L73YCK`/`JTc29`, docs/employee-settlements-page-redesign, Фаза 5) —
 * строится на клиенте из уже отфильтрованных строк ленты (тип + поиск по комментарию уже
 * применены выше, см. `useEmployeeBalancePage`), тот же приём, что `buildEmployeeSettlementsCsv`
 * — без похода на бэкенд, отдельного эндпоинта серверной генерации в контракте нет. Суммы —
 * сырым числом со знаком (не `formatSignedCurrency`), чтобы Excel видел число, а не строку с «₽».
 */
export function buildEmployeeBalanceLedgerCsv(
    transactions: BalanceTransaction[],
    employeeNameById: Record<number, string>,
): string {
    const header = ['Дата', 'Тип', 'Направление', 'Сумма, ₽', 'Комментарий', 'Автор', 'Документ']
    const rows = transactions.map((transaction) => [
        formatShortDate(transaction.occurredAt),
        transactionTypeLabel[transaction.type],
        DIRECTION_LABEL[transaction.direction],
        String(transaction.amount),
        transaction.comment ?? '',
        employeeNameById[transaction.createdBy] ?? `ID ${transaction.createdBy}`,
        transaction.erp !== null ? transaction.erp.externalId : transaction.accrualId !== null ? 'Документ начисления' : '',
    ])

    const lines = [header, ...rows].map((row) => row.map(escapeCsvField).join(';'))
    return '﻿' + lines.join('\r\n')
}

/** Триггерит скачивание CSV-файла — временная `<a download>`-ссылка на `Blob`-URL, тот же приём,
 * что `downloadEmployeeSettlementsCsv`. Имя файла включает id сотрудника и дату выгрузки (не
 * период — лента может быть отфильтрована по нескольким типам сразу, а не по одному месяцу). */
export function downloadEmployeeBalanceLedgerCsv(
    employeeId: number,
    transactions: BalanceTransaction[],
    employeeNameById: Record<number, string>,
): void {
    const blob = new Blob([buildEmployeeBalanceLedgerCsv(transactions, employeeNameById)], {
        type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    try {
        const link = document.createElement('a')
        link.href = url
        link.download = `employee-balance-${employeeId}-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    } finally {
        URL.revokeObjectURL(url)
    }
}
