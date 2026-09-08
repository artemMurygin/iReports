import type { Deal } from '@/kernel/types'
import { useDealsOverTime } from '@/features/DealsOverTimeCharts/model/useDealsOverTime'
import { TOP_N } from '@/features/DealsOverTimeCharts/model/config'
import { Layout } from '@/features/DealsOverTimeCharts/ui/Layout'
import { Header } from '@/features/DealsOverTimeCharts/ui/Header'
import { TabButton } from '@/features/DealsOverTimeCharts/ui/TabButton'
import { GridTab } from '@/features/DealsOverTimeCharts/ui/GridTab'
import { ChartTab } from '@/features/DealsOverTimeCharts/ui/ChartTab/ChartTab'
import { MiniCard } from '@/features/DealsOverTimeCharts/ui/MiniCard'

interface DealsOverTimeLinearChartProps {
    deals: Deal[]
}

export function DealsOverTimeCharts({ deals }: DealsOverTimeLinearChartProps) {
    const { activeTab, setActiveTab, ranked, dayData, globalMaxDay, weekData, weekDataLen, topSources, tailSources } =
        useDealsOverTime(deals)

    return (
        <Layout
            header={
                <Header
                    title="Лиды во времени"
                    description="Динамика по рекламным источникам"
                    tabsActions={
                        <>
                            <TabButton active={activeTab === 'grid'} onClick={() => setActiveTab('grid')}>
                                По дням
                            </TabButton>
                            <TabButton active={activeTab === 'chart'} onClick={() => setActiveTab('chart')}>
                                Топ-{TOP_N} по неделям
                            </TabButton>
                        </>
                    }
                />
            }
            body={
                activeTab === 'grid' ? (
                    <GridTab
                        ranked={ranked}
                        renderItem={(source) => (
                            <MiniCard key={source} source={source} data={dayData} globalMax={globalMaxDay} />
                        )}
                    />
                ) : (
                    <ChartTab
                        data={weekData}
                        ranked={ranked}
                        topSources={topSources}
                        tailSources={tailSources}
                        dataLength={weekDataLen}
                    />
                )
            }
        />
    )
}
