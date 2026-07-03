import { ServicesFilterBar } from './components/ServicesFilterBar'
import { CategoryBreadcrumbs } from './components/CategoryBreadcrumbs'
import { ServicesChart } from './components/ServicesChart'
import { ServicesTable } from './components/ServicesTable'
import { useServiceCategories } from './hooks/useServiceCategories'
import { useServicesAnalytics } from './hooks/useServicesAnalytics'
import { useServiceFilters } from './hooks/useServiceFilters'
import { SpinnerPageLg } from '@/shared/ui/SpinnerPageLg'
import { useBreadcrumbs } from './hooks/useBreadcrumbs'

export function ServicesAnalytics() {
    const { categories } = useServiceCategories()
    const { makeDefaultFilters, filters, setFilters } = useServiceFilters()
    const { breadcrumbs } = useBreadcrumbs(categories, filters)

    const { services, displayedServices, series, error, isInitialLoad, animClass, blurClass } =
        useServicesAnalytics(filters, categories)

    return (
        <main className="flex flex-col flex-1">
            <ServicesFilterBar
                filters={filters}
                categories={categories}
                services={services}
                onChange={setFilters}
                onReset={() => setFilters(makeDefaultFilters())}
            />
            <CategoryBreadcrumbs
                breadcrumbs={breadcrumbs}
                onChange={(id) =>
                    setFilters({ ...filters, selectedCategoryId: id, serviceIds: [] })
                }
            />
            {isInitialLoad ? (
                <SpinnerPageLg label="Загрузка данных..." />
            ) : (
                <div className={`flex flex-col gap-6 p-6 ${animClass} ${blurClass}`}>
                    {error && (
                        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}
                    <ServicesChart series={series} />
                    <ServicesTable services={displayedServices} />
                </div>
            )}
        </main>
    )
}
