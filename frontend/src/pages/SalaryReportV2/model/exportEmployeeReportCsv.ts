import { isFloatPercentRule, type EmployeeReportVM, type SalaryReportRule } from '@/features/SalaryReportData'

type RuleSource = SalaryReportRule['sources'][number]

/** Те же ярлыки типа источника, что и `RuleSourcesRail.tsx`'s `SOURCE_TYPE_LABELS` — заведены
 * заново по той же причине (`pages` не может переиспользовать другую `pages`, см.
 * `RuleSourcesRail.tsx`'s комментарий про `boundaries/dependencies`). */
const SOURCE_TYPE_LABELS: Record<string, string> = {
    order: 'Заказ',
    serviceOrderItem: 'Позиция услуги',
    taskCompletion: 'Задача',
    demandPosition: 'Позиция отгрузки',
}

function escapeCsvField(value: string): string {
    return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function formatAmountForCsv(value: number | null | undefined): string {
    return value === null || value === undefined ? '' : String(value)
}

function ruleTypeLabel(rule: SalaryReportRule): string {
    return isFloatPercentRule(rule) ? 'Плавающий процент · KPI' : 'Фиксированная ставка'
}

/** Основной лейбл источника — та же логика, что и `RuleSourcesRail.tsx`'s `composeDeviceName` +
 * `primaryLabel`, свёрнутая в одну строку (в CSV не нужно отдельно выделять устройство под
 * `itemName`, как в UI-мете, — здесь это один текстовый столбец «Позиция»). */
function sourcePositionLabel(source: RuleSource): string {
    if (source.itemName) return source.itemName
    const deviceParts = [source.brand, source.deviceModel].filter(Boolean)
    if (deviceParts.length > 0) {
        const name = deviceParts.join(' ')
        return source.deviceColor ? `${name}, ${source.deviceColor}` : name
    }
    return SOURCE_TYPE_LABELS[source.type] ?? source.type
}

/** Строит блок «лист детализации» одного правила — заголовок с направлением+названием правила,
 * колонки `RuleSourcesRail`'s "Позиция/Документ/Неисправность/Факт/Прогноз" и по строке на каждый
 * `rule.sources[]` (заказы/позиции, из которых собрана сумма правила) — тот же список, что
 * разворачивается в UI по клику на строку правила (`LedgerRuleRow`+`RuleSourcesRail`), только без
 * порога "показать 3, затем всё": в файл всегда попадают все источники целиком. */
function buildRuleSourcesSection(directionLabel: string, rule: SalaryReportRule): string[][] {
    const section: string[][] = [
        [`${directionLabel} — ${rule.name}`],
        ['Позиция', 'Документ №', 'Неисправность', 'Факт, ₽', 'Прогноз, ₽'],
    ]

    if (rule.sources.length === 0) {
        section.push(['Нет связанных документов', '', '', '', ''])
        return section
    }

    for (const source of rule.sources) {
        section.push([
            sourcePositionLabel(source),
            source.label ?? '',
            source.malfunction ?? '',
            formatAmountForCsv(source.amount?.fact),
            formatAmountForCsv(source.amount?.prognose),
        ])
    }
    return section
}

/**
 * Строит содержимое CSV-выгрузки отчёта сотрудника:
 * 1. Сводная таблица — по строке на каждое правило каждого присутствующего направления
 *    (`report.directions[].rules[]`, те же данные, что и в `LedgerDirectionBlock`/`LedgerRuleRow`:
 *    направление, название правила, тип начисления, факт/прогноз), с промежуточным итогом по
 *    направлению (`direction.total`) и общим итогом (`report.grandTotal`) в конце — тот же
 *    паттерн, что и `buildDepartmentReportCsv`.
 * 2. «Детализация по правилам» — отдельный лист-секция (`buildRuleSourcesSection`) на каждое
 *    правило с его документами-источниками (`rule.sources`, то же, что раскрывает `RuleSourcesRail`
 *    в UI по клику на строку правила), разделённые пустой строкой. CSV не поддерживает настоящие
 *    Excel-листы — секции с заголовком-названием правила эмулируют ту же идею одним плоским файлом,
 *    без добавления в проект новой зависимости для генерации XLSX.
 *
 * Всё строится на клиенте из уже загруженного `report`, без нового запроса к бэкенду (эндпоинта
 * серверной генерации CSV в контракте нет).
 *
 * `employeeName` — не часть `EmployeeReportVM` (имя сотрудника приходит отдельным запросом
 * идентичности, см. `useSalaryReportPage`), поэтому передаётся снаружи и, если известно, кладётся
 * отдельной строкой перед таблицей — иначе выгруженный файл, взятый в отрыве от браузера, было бы
 * невозможно соотнести с конкретным сотрудником.
 */
export function buildEmployeeReportCsv(report: EmployeeReportVM, employeeName: string | null): string {
    const summaryHeader = ['Направление', 'Правило начисления', 'Тип', 'Факт, ₽', 'Прогноз, ₽']

    const summaryRows: string[][] = []
    for (const direction of report.directions) {
        for (const rule of direction.rules) {
            summaryRows.push([
                direction.label,
                rule.name,
                ruleTypeLabel(rule),
                formatAmountForCsv(rule.amount.fact),
                formatAmountForCsv(rule.amount.prognose),
            ])
        }
        summaryRows.push([
            direction.label,
            'Итого по направлению',
            '',
            formatAmountForCsv(direction.total.fact),
            formatAmountForCsv(direction.total.prognose),
        ])
    }
    summaryRows.push([
        '',
        'Итого',
        '',
        formatAmountForCsv(report.grandTotal.fact),
        formatAmountForCsv(report.grandTotal.prognose),
    ])

    const detailSections: string[][] = [['Детализация по правилам']]
    for (const direction of report.directions) {
        for (const rule of direction.rules) {
            detailSections.push([], ...buildRuleSourcesSection(direction.label, rule))
        }
    }

    const metaLines = employeeName !== null ? [[`Сотрудник: ${employeeName}`]] : []
    const lines = [...metaLines, summaryHeader, ...summaryRows, [], ...detailSections].map((row) =>
        row.map(escapeCsvField).join(';'),
    )
    return '\uFEFF' + lines.join('\r\n')
}

/** Триггерит скачивание CSV-файла отчёта сотрудника в браузере — временная `<a download>`-ссылка
 * на `Blob`-URL, без похода на бэкенд (см. `buildEmployeeReportCsv`). Имя файла включает период
 * отчёта, чтобы повторные выгрузки за разные месяцы не перезаписывали друг друга в папке загрузок. */
export function downloadEmployeeReportCsv(report: EmployeeReportVM, employeeName: string | null): void {
    const blob = new Blob([buildEmployeeReportCsv(report, employeeName)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    try {
        const link = document.createElement('a')
        link.href = url
        link.download = `salary-report-employee-${report.period}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    } finally {
        URL.revokeObjectURL(url)
    }
}
