import { DealsFilterBar } from '@/pages/FunnelReport/ui/DealsFilterBar.tsx'
import { FunnelReportServiceLayout } from '@/pages/FunnelReport/ui/FunnelReportServiceLayout.tsx'
import { useFilters } from '@/pages/FunnelReport/model/useFilters.tsx'
import { DealsKPIBar } from '@/pages/FunnelReport/ui/DealsKPIBar.tsx'
import { useDeals } from '@/pages/FunnelReport/model/useDeals.tsx'
import { DealsOverTimeLinearChart } from '@/pages/FunnelReport/ui/DealsOverTimeLinearChart.tsx'
import { DealsBySourceChart } from '@/features/DealsBySourceChart'
import { DealsFunnelChart } from '@/features/DealsFunnelChart'
import { DealsByManagerChart } from '@/features/DealsByManagerChart'
import { ServiceDealsTable } from '@/features/ServiceDealsTable'
import { Grid } from '@/shared/ui/Grid.tsx'
import { DealsByStage } from '@/features/DealsByStage'

export function FunnelReportService() {
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
        defaultFilters,
    } = useFilters()

    const { loading, isInitialLoad, animClass, blurClass, KPI, deals } = useDeals(filters, setError)

    // нужно рефачить useDeals
    return (
        <FunnelReportServiceLayout
            isInitialLoad={isInitialLoad}
            animClass={animClass}
            blurClass={blurClass}
            error={error}
            header={
                <DealsFilterBar
                    filters={filters}
                    employees={employees}
                    sources={sources}
                    deviceTypes={deviceTypes}
                    stages={stages}
                    stageGroups={stageGroups}
                    loading={loading}
                    onChange={setFilters}
                    onReset={() => setFilters(defaultFilters)}
                />
            }
            body={
                <>
                    <DealsKPIBar KPI={KPI} />
                    <DealsOverTimeLinearChart deals={deals} />
                    <Grid cols={2} className="gap-4">
                        <DealsBySourceChart deals={deals} />
                        <Grid className="gap-4 h-full">
                            <DealsFunnelChart deals={deals} />
                            <DealsByManagerChart deals={deals} />
                        </Grid>
                    </Grid>
                    <ServiceDealsTable deals={deals} />
                    <DealsByStage deals={deals} />
                </>
            }
        />
    )
}
