import type { ChartSeriesEntry } from '@/kernel/types'
import { CHART_COLORS } from '@/kernel/chartColors'
import { SeriesCard } from '@/features/ServicesChart/ui/SeriesCard.tsx'
import { CombinedChart } from '@/features/ServicesChart/ui/CombinedChart.tsx'
import type { ChartMode } from '@/features/ServicesChart/model/types.ts'

type Props = {
    series: ChartSeriesEntry[]
    mode: ChartMode
}

export function ChartBody({ series, mode }: Props) {
    if (series.length <= 1) {
        return <CombinedChart series={series} mode={mode} />
    }

    return (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3 xl:grid-cols-5">
            {series.map((s, i) => (
                <SeriesCard key={s.id} series={s} mode={mode} color={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
        </div>
    )
}
