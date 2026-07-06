import { useState } from 'react'
import type { ChartSeriesEntry } from '@/kernel/types'
import { ChartHeader } from '@/shared/ui/ChartHeader.tsx'
import { ChartLayout } from '@/shared/ui/ChartLayout.tsx'
import { ChartBody } from '@/features/ServicesChart/ui/ChartBody.tsx'
import type { ChartMode } from '@/features/ServicesChart/model/types.ts'

const MODES: { value: ChartMode; label: string }[] = [
    { value: 'count', label: 'Количество' },
    { value: 'avgPrice', label: 'Средний чек' },
    { value: 'revenue', label: 'Выручка' },
]

const TITLES: Record<ChartMode, string> = {
    count: 'Динамика продаж услуг',
    avgPrice: 'Средний чек услуги',
    revenue: 'Выручка по услугам',
}

const DESCRIPTIONS: Record<ChartMode, string> = {
    count: 'Количество продаж по периодам',
    avgPrice: 'Средняя стоимость услуги по периодам, ₽',
    revenue: 'Сумма продаж услуг по периодам, ₽',
}

type Props = {
    series: ChartSeriesEntry[]
}

export function ServicesChart({ series }: Props) {
    const [mode, setMode] = useState<ChartMode>('count')

    return (
        <ChartLayout>
            <ChartHeader
                title={TITLES[mode]}
                description={DESCRIPTIONS[mode]}
                actions={
                    <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs shrink-0">
                        {MODES.map((m) => (
                            <button
                                key={m.value}
                                onClick={() => setMode(m.value)}
                                className={`px-3 py-1.5 transition-colors ${mode === m.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                }
            />
            <ChartBody series={series} mode={mode} />
        </ChartLayout>
    )
}
