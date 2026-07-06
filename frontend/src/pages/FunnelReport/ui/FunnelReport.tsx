import { Filters } from '@/pages/FunnelReport/ui/Filters.tsx'
import { Layout } from '@/pages/FunnelReport/ui/Layout.tsx'
import { useFilters } from '@/pages/FunnelReport/model/useFilters.tsx'
import { useDeals } from '@/pages/FunnelReport/model/useDeals.tsx'
import { DealsOverTimeCharts } from '@/features/DealsOverTimeCharts'
import { DealsBySourceChart } from '@/features/DealsBySourceChart'
import { DealsFunnelChart } from '@/features/DealsFunnelChart'
import { DealsByManagerChart } from '@/features/DealsByManagerChart'
import { DealsTable } from '@/features/DealsTable'
import { Grid } from '@/shared/ui/Grid.tsx'
import { DealsByStage } from '@/features/DealsByStage'
import { KpiCard } from '@/shared/ui/KpiCard.tsx'

export function FunnelReport() {
    const {
        filters,
        employees,
        sources,
        deviceTypes,
        stages,
        stageGroups,
        setFilters,
        setError,
        error,
        defaults,
    } = useFilters()

    const { loading, isInitialLoad, isRefreshing, dataVersion, KPI, deals } = useDeals(
        filters,
        setError,
    )

    return (
        <Layout
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            dataVersion={dataVersion}
            error={error}
            header={
                <Filters
                    filters={filters}
                    employees={employees}
                    sources={sources}
                    deviceTypes={deviceTypes}
                    stages={stages}
                    stageGroups={stageGroups}
                    loading={loading}
                    onChange={setFilters}
                    onReset={() => setFilters(defaults)}
                />
            }
            body={
                <>
                    <Grid cols={10} gap={2}>
                        <KpiCard label="Всего" value={KPI.allLeads ?? ''} />
                        <KpiCard label="Нецелевые" value={KPI.nonTargetDeals ?? ''} />
                        <KpiCard label="Целевые" value={KPI.targetedLeads ?? ''} />
                        <KpiCard label="В работе" value={KPI.inWork ?? ''} />
                        <KpiCard label="Записаны" value={KPI.waitingInService ?? ''} />
                        <KpiCard label="В ремонте" value={KPI.inService ?? ''} />
                        <KpiCard label="Успешные" value={KPI.won ?? ''} />
                        <KpiCard label="Отказы" value={KPI.lose ?? ''} />
                        <KpiCard
                            label="Выручка"
                            value={KPI.revenue?.toLocaleString('Ru-ru') ?? ''}
                        />
                        <KpiCard label="Конверсия" value={`${KPI.conversionRate ?? ''} %`} />
                    </Grid>
                    <DealsOverTimeCharts deals={deals} />
                    <Grid cols={2}>
                        <DealsBySourceChart deals={deals} />
                        <Grid>
                            <DealsFunnelChart deals={deals} />
                            <DealsByManagerChart deals={deals} />
                        </Grid>
                    </Grid>
                    <DealsTable deals={deals} />
                    <DealsByStage deals={deals} />
                </>
            }
        />
    )
}
