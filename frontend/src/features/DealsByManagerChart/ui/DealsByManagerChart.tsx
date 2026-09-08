import type { Deal } from '@/kernel/types'
import { useManagerStats } from '@/features/DealsByManagerChart/model/useManagerStats'
import { ChartHeader } from '@/shared/ui/ChartHeader'
import { ChartLayout } from '@/shared/ui/ChartLayout'
import { CardContent } from '@/shared/ui/card'
import { ManagerRow } from './ManagerRow'

type Props = {
    deals: Deal[]
}

export function DealsByManagerChart({ deals }: Props) {
    const { data } = useManagerStats(deals)

    return (
        <ChartLayout>
            <ChartHeader title="Показатели по менеджерам" description="Конверсия, кол-во сделок и выручка" />
            <CardContent className="flex-1 flex flex-col gap-3 pt-2 min-h-0">
                <div
                    className="flex items-center gap-3 text-xs text-gray-400"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                >
                    <span className="shrink-0" style={{ width: 130 }}>
                        Менеджер
                    </span>
                    <span className="flex-1">Конверсия</span>
                    <div className="flex gap-3 shrink-0">
                        <span className="w-[60px] text-right">Сделки</span>
                        <span className="w-[90px] text-right">Выручка</span>
                    </div>
                </div>
                {!data.length && <p className="text-sm text-gray-400 py-4 text-center">Нет данных</p>}
                {data.map((item) => (
                    <ManagerRow key={item.managerId} item={item} />
                ))}
            </CardContent>
        </ChartLayout>
    )
}
