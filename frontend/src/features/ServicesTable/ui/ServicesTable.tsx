import type { ServiceAnalyticsEntry } from '@/kernel/types'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { useServicesStats } from '@/features/ServicesTable/model/useServicesStats.ts'
import { useServiceRowsFilter } from '@/features/ServicesTable/model/useServiceRowsFilter.ts'
import { useServicesTablePage } from '@/features/ServicesTable/model/useServicesTablePage.ts'
import { useLoadMoreRows } from '@/features/ServicesTable/model/useLoadMoreRows.ts'
import { useColumnVisibility } from '@/features/ServicesTable/model/useColumnVisibility.ts'
import { ServicesTableHeader } from '@/features/ServicesTable/ui/ServicesTableHeader.tsx'
import { ServicesTableDesktop } from '@/features/ServicesTable/ui/ServicesTableDesktop.tsx'
import { ServiceMobileCard } from '@/features/ServicesTable/ui/ServiceMobileCard.tsx'
import { TablePagination } from '@/features/ServicesTable/ui/TablePagination.tsx'

interface Props {
    services: ServiceAnalyticsEntry[]
}

export function ServicesTable({ services }: Props) {
    const { sorted, maxCount, totalRevenue } = useServicesStats(services)
    const { search, setSearch, variantFilter, setVariantFilter, filteredRows } = useServiceRowsFilter(sorted)
    const { visibility, toggleColumn } = useColumnVisibility()
    const desktopPage = useServicesTablePage(filteredRows, search, variantFilter, services)
    const mobileList = useLoadMoreRows(filteredRows, search, variantFilter, services)

    if (sorted.length === 0) {
        return (
            <div className="rounded-xl border border-hairline bg-surface p-10 text-center">
                <p className="text-sm text-ink-muted">Нет данных за выбранный период</p>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-hairline bg-surface overflow-hidden">
            <ServicesTableHeader
                totalServicesCount={sorted.length}
                totalRevenue={totalRevenue}
                search={search}
                onSearchChange={setSearch}
                variantFilter={variantFilter}
                onVariantFilterChange={setVariantFilter}
                columnVisibility={visibility}
                onColumnToggle={toggleColumn}
            />

            {filteredRows.length === 0 ? (
                <div className="p-10 text-center">
                    <p className="text-sm text-ink-muted">Ничего не найдено</p>
                </div>
            ) : (
                <>
                    <div className="hidden md:block">
                        <ServicesTableDesktop
                            rows={desktopPage.pageRows}
                            startIndex={desktopPage.startIndex}
                            maxCount={maxCount}
                            columnVisibility={visibility}
                        />
                        <TablePagination
                            shown={desktopPage.shown}
                            total={desktopPage.total}
                            page={desktopPage.page}
                            pageCount={desktopPage.pageCount}
                            onPageChange={desktopPage.setPage}
                        />
                    </div>

                    <div className="divide-y divide-hairline p-3.5 md:hidden">
                        <div className="flex flex-col gap-3.5 pb-3.5">
                            {mobileList.visibleRows.map((row, idx) => (
                                <ServiceMobileCard key={row.serviceId} row={row} index={idx} maxCount={maxCount} />
                            ))}
                        </div>
                        <div className="flex flex-col items-center gap-2 pt-3.5">
                            {mobileList.canShowMore && (
                                <Button variant="secondary" className="w-full" onClick={mobileList.showMore}>
                                    Показать ещё
                                </Button>
                            )}
                            <p className="text-[11px] text-ink-muted">
                                Показано {mobileList.shown} из {mobileList.total} услуг
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
