import type { ServiceAnalyticsEntry } from '@/kernel/types'

function escapeCsvField(value: string): string {
    return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function formatNumberForCsv(value: number): string {
    return String(value)
}

/**
 * Строит содержимое CSV-выгрузки страницы `/services` — построчно по уже загруженным
 * `services[]` (см. `ServiceAnalyticsEntry`, `@/kernel/types`), без нового запроса к бэкенду
 * (эндпоинта серверной генерации CSV в контракте нет). Разделитель `;` (не `,`) и BOM в начале
 * строки — так Excel/LibreOffice в ru-локали открывают файл с кириллицей без ручного выбора
 * кодировки/разделителя при двойном клике (тот же приём, что и
 * `pages/SalaryReportV2/model/exportDepartmentReportCsv.ts`).
 */
export function buildServicesReportCsv(services: ServiceAnalyticsEntry[]): string {
    const header = [
        'Услуга',
        'Продажи',
        'Розничная цена',
        'Цена продажи',
        'Начисление мастеру',
        'Средний чек',
        'Выручка',
        'Прибыль',
    ]
    const rows = services.map((service) => [
        service.serviceName,
        formatNumberForCsv(service.totalCount),
        formatNumberForCsv(service.retailPrice),
        formatNumberForCsv(service.avgServicePrice),
        formatNumberForCsv(service.totalEngineerBonus),
        formatNumberForCsv(service.avgOrderCheck),
        formatNumberForCsv(service.totalRevenue),
        formatNumberForCsv(service.totalProfit),
    ])

    const lines = [header, ...rows].map((row) => row.map(escapeCsvField).join(';'))
    return '﻿' + lines.join('\r\n')
}

/** Триггерит скачивание CSV-файла в браузере — временная `<a download>`-ссылка на `Blob`-URL, без
 * похода на бэкенд (см. `buildServicesReportCsv`). Имя файла включает дату выгрузки, чтобы
 * повторные выгрузки в один день не создавали неоднозначных дублей в папке загрузок. */
export function downloadServicesReportCsv(services: ServiceAnalyticsEntry[]): void {
    const blob = new Blob([buildServicesReportCsv(services)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    try {
        const link = document.createElement('a')
        link.href = url
        link.download = `services-report-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    } finally {
        URL.revokeObjectURL(url)
    }
}
