import type { ServiceAnalyticsEntry } from '@/kernel/types'
import { fmtMoney, profitColorClass } from './format.ts'

/**
 * Опциональные (переключаемые через Columns Popover) денежные колонки десктоп-таблицы
 * (Pencil: `h7eHG` → `tmW21` "Table Section"). "#"/"Услуга"/"Продажи"/"Тренд" всегда видимы и
 * сюда не входят — см. `ServicesTableHeaderRow`/`ServicesTableRow`.
 */
export type OptionalColumnId =
    | 'retailPrice'
    | 'avgServicePrice'
    | 'totalEngineerBonus'
    | 'avgOrderCheck'
    | 'totalRevenue'
    | 'totalProfit'

export type OptionalColumnConfig = {
    id: OptionalColumnId
    /** Подпись в заголовке таблицы и в списке Columns Popover — совпадает дословно, менять
     * нельзя (явное требование задачи сохранить существующие подписи колонок). */
    label: string
    field: keyof Pick<ServiceAnalyticsEntry, OptionalColumnId>
}

// Порядок — как в заголовке макета: Розничная цена · Цена продажи · Начисление мастеру ·
// Средний чек · Выручка · Прибыль.
export const OPTIONAL_COLUMNS: OptionalColumnConfig[] = [
    { id: 'retailPrice', label: 'Розничная цена', field: 'retailPrice' },
    { id: 'avgServicePrice', label: 'Цена продажи', field: 'avgServicePrice' },
    { id: 'totalEngineerBonus', label: 'Начисление мастеру', field: 'totalEngineerBonus' },
    { id: 'avgOrderCheck', label: 'Средний чек', field: 'avgOrderCheck' },
    { id: 'totalRevenue', label: 'Выручка', field: 'totalRevenue' },
    { id: 'totalProfit', label: 'Прибыль', field: 'totalProfit' },
]

export const OPTIONAL_COLUMN_IDS: OptionalColumnId[] = OPTIONAL_COLUMNS.map((column) => column.id)

export type ColumnVisibility = Record<OptionalColumnId, boolean>

/** Значение + цвет опциональной денежной ячейки десктоп-строки — все колонки одинаково
 * форматируются `fmtMoney`, кроме "Прибыль", которая красится по знаку (`profitColorClass`). */
export function formatOptionalColumnValue(
    row: ServiceAnalyticsEntry,
    column: OptionalColumnConfig,
): { text: string; colorClass: string } {
    const raw = row[column.field]
    if (column.id === 'totalProfit') {
        return { text: fmtMoney(raw), colorClass: profitColorClass(raw) }
    }
    return { text: fmtMoney(raw), colorClass: 'text-ink' }
}
