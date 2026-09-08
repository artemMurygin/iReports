import { type Deal } from '@/kernel/types'
import { useStats } from '@/features/DealsBySourceChart/model/useStats.ts'
import { ChartHeader } from '@/shared/ui/ChartHeader.tsx'
import { ChartLayout } from '@/shared/ui/ChartLayout.tsx'
import { ChartRow } from '@/features/DealsBySourceChart/ui/ChartRow.tsx'
import { ChartBody } from '@/features/DealsBySourceChart/ui/ChartBody.tsx'
import { useSort } from '@/features/DealsBySourceChart/model/useSort.ts'

type Props = {
    deals: Deal[]
}

export function DealsBySourceChart({ deals }: Props) {
    const { data } = useStats(deals)
    const { sorted, max } = useSort(data)

    return (
        <ChartLayout>
            <ChartHeader title="Источники лидов" description="Распределение по рекламным каналам" />
            <ChartBody data={sorted} renderRow={(item) => <ChartRow key={item.sourceId} item={item} max={max} />} />
        </ChartLayout>
    )
}
