import { type Deal } from '@/kernel/types'
import { useStats } from '@/features/DealsBySourceChart/hooks/useStats.ts'
import { ChartHeader } from '@/shared/ui/ChartHeader.tsx'
import { ChartLayout } from '@/shared/ui/ChartLayout.tsx'
import { ChartRow } from '@/features/DealsBySourceChart/components/ChartRow.tsx'
import { ChartBody } from '@/features/DealsBySourceChart/components/ChartBody.tsx'

type Props = {
    deals: Deal[]
}

export function DealsBySourceChart({ deals }: Props) {
    const { data } = useStats(deals)

    const sorted = [...data].sort((a, b) => b.count - a.count)
    const max = Math.max(...sorted.map((item) => item.count), 1)

    return (
        <ChartLayout>
            <ChartHeader title="Источники лидов" description="Распределение по рекламным каналам" />
            <ChartBody
                data={sorted}
                renderRow={(item) => <ChartRow key={item.sourceId} item={item} max={max} />}
            />
        </ChartLayout>
    )
}
