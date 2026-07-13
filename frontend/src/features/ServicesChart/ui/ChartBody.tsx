import { CardContent } from '@/shared/ui/card'
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
    return (
        <CardContent className="pt-2 pb-4">
            {series.length > 1 ? (
                <div className="grid grid-cols-2 gap-3">
                    {series.map((s, i) => (
                        <div
                            key={s.id}
                            className={series.length % 2 !== 0 && i === series.length - 1 ? 'col-span-2' : ''}
                        >
                            <SeriesCard series={s} mode={mode} color={CHART_COLORS[i % CHART_COLORS.length]} />
                        </div>
                    ))}
                </div>
            ) : (
                <CombinedChart series={series} mode={mode} />
            )}
        </CardContent>
    )
}
