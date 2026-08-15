import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { SalesDirection } from 'ireports-contracts'

import {
    DEFAULT_DIRECTION,
    KpiRow,
    SalesPlanCardList,
    SalesPlanEmptyState,
    SalesPlanTable,
    formatPeriodLabel,
    useSalesPlan,
} from '@/features/SalesPlan'
import { ErrorLayout } from '@/shared/ui/ErrorLayout.tsx'
import { Spinner } from '@/shared/ui/Spinner'
import { SpinnerPageLg } from '@/shared/ui/SpinnerPageLg'

import { KpiGridMobile } from './KpiGridMobile.tsx'
import { PageHeader } from './PageHeader.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, node `x2soj` (`План продаж · Список`, desktop,
 * `md:` and up) / `hYl0B` (`План продаж · Мобильный`, below `md:`) -> `T0FMcE` (`Content`) —
 * `Main`/`Content` frame: `canvas` background, 16px gap between `PageHeader`, the KPI
 * block, and the category list. The design's `Selection Bar` (`LSV9W`) and the mobile list's
 * "Select All" checkbox have no place here — this is a view-only page with no row selection
 * (see Фаза 2 in docs/sales-plan-view-page/plan-sales-plan-view-page.md).
 *
 * Breakpoint switch (`hidden md:flex` / `flex md:hidden`, same convention as
 * `HeaderDesktop`/`HeaderMobile` in `shared/ui-kit/organisms/Header/Header.tsx`) rather than a
 * JS width check, so it switches purely on CSS with no layout flash: `KpiRow`/`SalesPlanTable`
 * on `md:` and up, `KpiGridMobile`/`SalesPlanCardList` below that. `KpiGridMobile` (unlike
 * `KpiRow`) drops the "Выручка · прогноз" card — matches `T0FMcE`'s `JvB6D` node 1:1, see that
 * component's comment.
 *
 * `direction` is owned here (not inside `useSalesPlan`) so the Direction Tabs in
 * `PageHeader` can drive it — `useSalesPlan` switches its data source (service vs. shop
 * `salesPerformance` + category resolution) internally based on the `direction` it's given
 * (see Фазу 4 in docs/sales-plan-view-page/plan-sales-plan-view-page.md), so this page and
 * the UI it renders stay direction-agnostic.
 *
 * Loading/empty/error (Фаза 5): `isInitialLoad`/`isRefreshing` follow the project convention
 * (`useServicesAnalytics`/`useDeals`, see frontend/CLAUDE.md) — `SpinnerPageLg` blocks the whole
 * block only while there's no data yet; a background refetch (e.g. switching direction to an
 * already-visited tab, or a window-focus revalidation) instead keeps the last rows on screen
 * with a light blur + inline "Обновление..." indicator. `salesPerformance` is empty for any
 * period other than the seeded `2026-06` test data, so an empty (but not errored) result renders
 * `SalesPlanEmptyState` in place of both `SalesPlanTable` and `SalesPlanCardList` — the same
 * block covers both breakpoints. `error` (from `ApiError.message`, see
 * `shared/errors/apiError.ts`) renders as a banner; if a background refetch fails while stale
 * rows are still on screen, those rows stay visible below the banner instead of being replaced
 * by it.
 */
export function SalesPlanPage() {
    const [direction, setDirection] = useState<SalesDirection>(DEFAULT_DIRECTION)
    const { rows, totals, isInitialLoad, isRefreshing, error, period, dataVersion } = useSalesPlan(direction)
    const periodLabel = formatPeriodLabel(period)
    const hasData = rows.length > 0

    return (
        <main className="flex flex-1 flex-col gap-4 bg-canvas px-4 py-5 md:px-7 md:py-6">
            <PageHeader direction={direction} onDirectionChange={setDirection} periodLabel={periodLabel} />

            {isInitialLoad ? (
                <SpinnerPageLg label="Загрузка данных..." />
            ) : (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={dataVersion}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            filter: isRefreshing ? 'blur(1.5px)' : 'blur(0px)',
                            transition: { duration: 0.4, ease: 'easeOut' },
                        }}
                        exit={{ opacity: 0, y: 6, transition: { duration: 0.18, ease: 'easeIn' } }}
                        style={{ pointerEvents: isRefreshing ? 'none' : 'auto' }}
                        className="flex flex-col gap-4"
                    >
                        {error && <ErrorLayout error={error} />}

                        {isRefreshing && (
                            <div className="flex items-center justify-end gap-1.5 font-ui text-xs text-ink-muted">
                                <Spinner className="size-3.5" />
                                Обновление данных...
                            </div>
                        )}

                        {(!error || hasData) && (
                            <>
                                <KpiRow totals={totals} periodLabel={periodLabel} className="hidden md:block" />
                                <KpiGridMobile totals={totals} periodLabel={periodLabel} className="md:hidden" />

                                {hasData ? (
                                    <>
                                        <SalesPlanTable rows={rows} className="hidden md:block" />
                                        <SalesPlanCardList rows={rows} direction={direction} className="md:hidden" />
                                    </>
                                ) : (
                                    <SalesPlanEmptyState periodLabel={periodLabel} />
                                )}
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            )}
        </main>
    )
}
