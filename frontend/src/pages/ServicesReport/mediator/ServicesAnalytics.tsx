import { Layout } from '@/pages/ServicesReport/ui/Layout.tsx'
import { ServicesFilterBar } from '@/pages/ServicesReport/ui/ServicesFilterBar.tsx'
import { CategoryBreadcrumbs } from '@/pages/ServicesReport/ui/CategoryBreadcrumbs.tsx'
import { useFilters } from '@/pages/ServicesReport/model/useFilters.tsx'
import { useBreadcrumbs } from '@/pages/ServicesReport/model/useBreadcrumbs.ts'
import { useServicesAnalytics } from '@/pages/ServicesReport/model/useServicesAnalytics.tsx'
import { ServicesChart } from '@/features/ServicesChart'
import { ServicesTable } from '@/features/ServicesTable'

export function ServicesAnalytics() {
    const {
        filters,
        debouncedFilters,
        isDebouncing,
        resolvedCategoryIds,
        categories,
        setFilters,
        setError,
        error,
        defaults,
    } = useFilters()
    const { breadcrumbs } = useBreadcrumbs(categories, filters)
    const { services, series, isInitialLoad, isRefreshing, dataVersion } = useServicesAnalytics(
        debouncedFilters,
        categories,
        resolvedCategoryIds,
        isDebouncing,
        setError,
    )

    return (
        <Layout
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            dataVersion={dataVersion}
            error={error}
            header={
                <>
                    <ServicesFilterBar
                        filters={filters}
                        categories={categories}
                        services={services}
                        onChange={setFilters}
                        onReset={() => setFilters(defaults)}
                    />
                    <CategoryBreadcrumbs
                        breadcrumbs={breadcrumbs}
                        onChange={(id) =>
                            setFilters({
                                ...filters,
                                selectedCategoryId: id,
                                serviceIds: [],
                            })
                        }
                    />
                </>
            }
            body={
                <>
                    <ServicesChart series={series} />
                    <ServicesTable services={services} />
                </>
            }
        />
    )
}
