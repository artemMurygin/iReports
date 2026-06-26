import { DealsFilterBar } from './components/DealsFilterBar.tsx';
import { FunnelReportServiceLayout } from './components/FunnelReportServiceLayout.tsx';
import { useFilters } from './hooks/useFilters.tsx';
import { DealsKPIBar } from './components/DealsKPIBar.tsx';
import { useDeals } from './hooks/useDeals.tsx';
import { DealsOverTimeLinearChart } from './components/DealsOverTimeLinearChart.tsx';
import { DealsBySourceChart } from '@/features/DealsBySourceChart';
import { DealsFunnelChart } from '@/features/DealsFunnelChart';
import { ServiceDealsTable } from '@/features/ServiceDealsTable';
import { Grid } from '@/shared/ui/Grid.tsx';


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
        defaultFilters
    } = useFilters()

    const {
        loading,
        KPI,
        deals
    } = useDeals(filters, setError)

    return (
        <FunnelReportServiceLayout
            loading={loading}
            error={error}
            filterBar={
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
        >
            <DealsKPIBar KPI={KPI} />

            <Grid
                cols={2}
                className="gap-4 "
                children={
                    <>
                        <DealsBySourceChart deals={deals} />
                        <DealsFunnelChart deals={deals} />
                    </>
                }
            />
            <DealsOverTimeLinearChart deals={deals} />
            <ServiceDealsTable deals={deals} />
            {/*<DealsByStage deals={deals} />*/}



        </FunnelReportServiceLayout>
    )
}