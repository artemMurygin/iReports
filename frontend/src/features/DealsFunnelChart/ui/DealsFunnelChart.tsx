import type { Deal } from '@/kernel/types'
import { useFunnelStats } from '@/features/DealsFunnelChart/model/useFunnelStats.ts'
import { FunnelChartHeader } from './FunnelChartHeader.tsx'
import { FunnelChartLayout } from './FunnelChartLayout.tsx'
import { FunnelChartBody } from './FunnelChartBody.tsx'
import { FunnelRow } from './FunnelRow.tsx'

type Props = {
    deals: Deal[]
}

export function DealsFunnelChart({ deals }: Props) {
    const { maxCount, mainRows, branchRows } = useFunnelStats(deals)

    return (
        <FunnelChartLayout>
            <FunnelChartHeader
                title="Воронка продаж"
                description="Прохождение заявок по этапам сделки"
            />
            <FunnelChartBody
                mainRows={mainRows}
                branchRows={branchRows}
                renderRow={(item) => <FunnelRow key={item.id} item={item} max={maxCount} />}
            />
        </FunnelChartLayout>
    )
}
