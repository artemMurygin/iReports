import type { BalanceSummaryEmployee, BalanceSummaryTotals } from 'ireports-contracts'

import { formatShortDate } from '@/shared/lib/format.ts'

function escapeCsvField(value: string): string {
    return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * CSV-выгрузка списка «Взаиморасчёты с сотрудниками» («Выгрузить таблицу», Pencil `IFJW2`
 * top-right / `wZnzC`, Фаза 4 docs/employee-settlements-page-redesign) — строится на клиенте
 * из уже загруженных `employees`/`totals` (тот же приём, что `buildDepartmentReportCsv` у
 * `/salaries`: разделитель `;` и BOM в начале строки для корректного открытия кириллицы в
 * Excel/LibreOffice, без похода на бэкенд — отдельного эндпоинта серверной генерации CSV в
 * контракте нет, те же данные, что уже показывают `EmployeeSettlementsTable`/
 * `EmployeeSettlementsCardList`). Суммы — сырым числом (не `formatCurrency`), как у
 * `formatAmountForCsv` там же — Excel должен видеть число, а не строку с «₽»/пробелами.
 */
export function buildEmployeeSettlementsCsv(employees: BalanceSummaryEmployee[], totals: BalanceSummaryTotals): string {
    const header = ['Сотрудник', 'Должность', 'Отдел', 'Статус', 'Последнее движение', 'Остаток, ₽']
    const employeeRows = employees.map((employee) => [
        employee.employeeName,
        employee.position ?? '',
        employee.departmentName,
        employee.isDismissed ? 'Уволен' : '',
        formatShortDate(employee.lastMovementAt),
        String(employee.balance),
    ])
    const totalRow = ['Итого', '', '', '', '', String(totals.balance)]

    const lines = [header, ...employeeRows, totalRow].map((row) => row.map(escapeCsvField).join(';'))
    return '\uFEFF' + lines.join('\r\n')
}

/** Триггерит скачивание CSV-файла в браузере — временная `<a download>`-ссылка на `Blob`-URL,
 * без похода на бэкенд (см. `buildEmployeeSettlementsCsv`). Имя файла включает дату выгрузки,
 * а не период (сводка от периода не зависит — `useEmployeeSettlementsPage`'s doc), чтобы
 * повторные выгрузки в один день не путались между собой в папке загрузок. */
export function downloadEmployeeSettlementsCsv(
    employees: BalanceSummaryEmployee[],
    totals: BalanceSummaryTotals,
): void {
    const blob = new Blob([buildEmployeeSettlementsCsv(employees, totals)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    try {
        const link = document.createElement('a')
        link.href = url
        link.download = `employee-settlements-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    } finally {
        URL.revokeObjectURL(url)
    }
}
