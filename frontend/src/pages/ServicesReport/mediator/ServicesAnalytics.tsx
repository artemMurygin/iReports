import { PageHeader } from '@/shared/ui-kit/organisms/PageHeader'

import { Layout } from '@/pages/ServicesReport/ui/Layout.tsx'
import { ServicesFilterBar } from '@/pages/ServicesReport/ui/ServicesFilterBar.tsx'
import { ServicesReportHeaderActions } from '@/pages/ServicesReport/ui/ServicesReportHeaderActions.tsx'
import { useFilters } from '@/pages/ServicesReport/model/useFilters.tsx'
import { useServicesAnalytics } from '@/pages/ServicesReport/model/useServicesAnalytics.tsx'
import { ServicesChart } from '@/features/ServicesChart'
import { ServicesTable } from '@/features/ServicesTable'

/**
 * `/services` — аналитика услуг (Pencil: `design/sallary-first-iteration.pen`, `h7eHG` "Аналитика
 * услуг · Redesign" / `aoOaU` мобильный). Мидиатор без условного рендера
 * (`frontend/CLAUDE.md`) — собирает `Layout`'s `header`/`body` слоты из `useFilters`/
 * `useServicesAnalytics`, вся отрисовка — в презентационных `ServicesFilterBar`/
 * `ServicesReportHeaderActions`/`ServicesChart`/`ServicesTable`. Хлебные крошки категории
 * (`CategoryBreadcrumbs`/`useBreadcrumbs`) убраны из шапки — чип текущей категории в
 * `CategoryTreeSelect` теперь сам показывает выбор и умеет его сбрасывать.
 */
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
                    <PageHeader
                        title="Аналитика услуг"
                        subtitle="Динамика продаж и структура выручки по категориям услуг"
                        actions={<ServicesReportHeaderActions services={services} />}
                    />

                    <ServicesFilterBar
                        filters={filters}
                        categories={categories}
                        services={services}
                        onChange={setFilters}
                        onReset={() => setFilters(defaults)}
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
