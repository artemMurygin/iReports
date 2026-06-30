import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format, startOfMonth } from 'date-fns'
import { PeriodPicker } from './PeriodPicker'
import { salaryApi } from '../api'
import type { MotivationRow } from '../types'

function pct(v: number | null) {
    if (v === null) return '—'
    return (v * 100).toFixed(1) + '%'
}

function money(v: number | null) {
    if (v === null) return '—'
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(v)
}

function FulfillmentBadge({ value }: { value: number | null }) {
    if (value === null) return <span className="text-gray-400">—</span>
    const pctVal = value * 100
    const color =
        pctVal >= 100 ? 'text-emerald-600 bg-emerald-50' :
        pctVal >= 70 ? 'text-amber-600 bg-amber-50' :
        'text-red-600 bg-red-50'
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
            {pctVal.toFixed(1)}%
        </span>
    )
}

export function MotivationView() {
    const [period, setPeriod] = useState<Date>(startOfMonth(new Date()))
    const [rows, setRows] = useState<MotivationRow[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const periodStr = format(period, 'yyyy-MM-dd')
        setLoading(true)
        salaryApi.getMotivation(periodStr)
            .then((r) => setRows(r.data))
            .catch(() => toast.error('Не удалось загрузить расчёт мотивации'))
            .finally(() => setLoading(false))
    }, [period])

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <PeriodPicker value={period} onChange={setPeriod} />
                {loading && (
                    <span className="text-xs text-gray-400 animate-pulse">Загрузка...</span>
                )}
            </div>

            {rows.length === 0 && !loading ? (
                <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
                    Нет данных за выбранный период
                </div>
            ) : (
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50 text-left">
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Правило</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Цель</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Метрика</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">План</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Факт</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-center">Выполнение</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-center">Коэф.</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-center">Базов. %</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-center">Итог. %</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Прогноз</th>
                                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-center">Пр. %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {rows.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-900">{row.ruleName}</td>
                                    <td className="px-4 py-3 text-gray-700">{row.targetName}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${row.metric === 'margin' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>
                                            {row.metric === 'revenue' ? 'Выручка' : 'Прибыль'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{money(row.planValue)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">{money(row.factValue)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <FulfillmentBadge value={row.fulfillment} />
                                    </td>
                                    <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                                        {row.coefficient !== null ? row.coefficient.toFixed(3) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-center tabular-nums text-gray-700">
                                        {pct(row.basePercent)}
                                    </td>
                                    <td className="px-4 py-3 text-center font-semibold">
                                        {row.factPercent !== null ? (
                                            <span className="text-emerald-700">{pct(row.factPercent)}</span>
                                        ) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums text-gray-500 italic">
                                        {money(row.forecastValue)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <FulfillmentBadge value={row.forecastFulfillment} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {rows.length > 0 && (
                <p className="text-xs text-gray-400 text-right">
                    {rows[0].daysPassed} из {rows[0].daysInMonth} рабочих дней • прогноз на основе текущего темпа
                </p>
            )}
        </div>
    )
}
