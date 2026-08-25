import type { DepartmentReportVM } from '@/features/SalaryReportData'

function escapeCsvField(value: string): string {
    return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function formatAmountForCsv(value: number | null): string {
    return value === null ? '' : String(value)
}

/**
 * Строит содержимое CSV-выгрузки отчёта (Pencil-диф "Выгрузить CSV", `o2fTU/cDc6b`) — построчно по
 * уже загруженным `report.employees[]` (имя, факт, прогноз) плюс итоговая строка `report.total`, без
 * нового запроса к бэкенду (эндпоинта серверной генерации CSV в контракте нет — те же данные, что
 * уже показывает `DepartmentLedgerV2`). Разделитель `;` (не `,`) и BOM в начале строки — так
 * Excel/LibreOffice в ru-локали открывают файл с кириллицей без ручного выбора кодировки/
 * разделителя при двойном клике.
 */
export function buildDepartmentReportCsv(report: DepartmentReportVM): string {
    const header = ['Сотрудник', 'Факт, ₽', 'Прогноз, ₽']
    const employeeRows = report.employees.map((employee) => [
        employee.name,
        formatAmountForCsv(employee.total.fact),
        formatAmountForCsv(employee.total.prognose),
    ])
    const totalRow = ['Итого', formatAmountForCsv(report.total.fact), formatAmountForCsv(report.total.prognose)]

    const lines = [header, ...employeeRows, totalRow].map((row) => row.map(escapeCsvField).join(';'))
    return '\uFEFF' + lines.join('\r\n')
}

/** Триггерит скачивание CSV-файла в браузере — временная `<a download>`-ссылка на `Blob`-URL, без
 * похода на бэкенд (см. `buildDepartmentReportCsv`). Имя файла включает период отчёта, чтобы
 * повторные выгрузки за разные месяцы не перезаписывали друг друга в папке загрузок. */
export function downloadDepartmentReportCsv(report: DepartmentReportVM): void {
    const blob = new Blob([buildDepartmentReportCsv(report)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    try {
        const link = document.createElement('a')
        link.href = url
        link.download = `salary-report-${report.period}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    } finally {
        URL.revokeObjectURL(url)
    }
}
