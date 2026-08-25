import { useState } from 'react'
import type { ChartSeriesEntry } from '@/kernel/types'
import { SegmentedControl } from '@/shared/ui-kit/atoms/SegmentedControl.tsx'
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
        <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                    <h2 className="font-ui text-base font-bold text-ink">{TITLES[mode]}</h2>
                    <p className="font-ui text-[12.5px] text-ink-muted">{DESCRIPTIONS[mode]}</p>
                </div>
                <SegmentedControl
                    options={MODES}
                    value={mode}
                    onValueChange={setMode}
                    aria-label="Режим графика аналитики услуг"
                />
            </div>
            <ChartBody series={series} mode={mode} />
        </section>
    )
}
