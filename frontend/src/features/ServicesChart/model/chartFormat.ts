import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ChartSeriesEntry } from '@/kernel/types'
import type { ChartMode } from './types'

export function formatPeriod(period: string): string {
    const parts = period.split('-')
    if (parts.length === 3) return `${parts[2]}.${parts[1]}`
    return `${parts[1]}.${parts[0]}`
}

export function getPointValue(b: { count: number; avgPrice: number; revenue: number }, mode: ChartMode): number {
    if (mode === 'count') return b.count
    if (mode === 'avgPrice') return b.avgPrice
    return b.revenue
}

export function buildChartData(series: ChartSeriesEntry[], mode: ChartMode) {
    if (!series.length) return []
    const periods = series[0].breakdown.map((b) => b.period)
    return periods.map((period, i) => {
        const row: Record<string, string | number> = {
            period,
            label: formatPeriod(period),
        }
        for (const s of series) {
            row[s.name] = getPointValue(s.breakdown[i] ?? { count: 0, avgPrice: 0, revenue: 0 }, mode)
        }
        return row
    })
}

export function buildSingleSeriesData(series: ChartSeriesEntry, mode: ChartMode) {
    return series.breakdown.map((b) => ({
        label: formatPeriod(b.period),
        value: getPointValue(b, mode),
    }))
}

export const ruFmt = (v: number) => v.toLocaleString('ru-RU')

export function fmtCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`
    if (n >= 1_000) return `${Math.round(n / 1_000)} тыс ₽`
    return `${n.toLocaleString('ru-RU')} ₽`
}

// Период приходит как ISO-дата бакета (день/начало недели/начало месяца, см.
// PeriodBucket на бэкенде — все три гранулярности сериализуются как полная
// дата "YYYY-MM-DD"). Короткий формат для подписей под мини-графиком карточки
// серии, вида "29 июн" — date-fns уже используется с ru-локалью в проекте
// (см. shared/ui/date-range-picker.tsx, features/EmployeeBalance/ui/NewTransactionDrawer.tsx).
export function formatShortDate(period: string): string {
    const date = new Date(period)
    if (Number.isNaN(date.getTime())) return period
    return format(date, 'd MMM', { locale: ru }).replace(/\.$/, '')
}

// Уникальный id для SVG <linearGradient> заливки мини-графика — карточек
// на странице несколько, у каждой свой градиент, id не должны коллизировать.
export function gradientIdFor(seriesId: string): string {
    const safe = seriesId.replace(/[^a-zA-Z0-9_-]/g, '') || 'series'
    return `services-chart-area-${safe}`
}
