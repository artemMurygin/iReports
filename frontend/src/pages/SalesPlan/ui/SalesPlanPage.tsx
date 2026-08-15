import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import type { SalesDirection } from 'ireports-contracts'

import {
    DEFAULT_DIRECTION,
    DEFAULT_PERIOD,
    EditPlanModal,
    KpiRow,
    SalesPlanCardList,
    SalesPlanEmptyState,
    SalesPlanTable,
    SelectionBar,
    SelectionBarMobile,
    formatPeriodLabel,
    useApproveSalesPlanRows,
    useSalesPlan,
    useSalesPlanSelection,
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
 * block, and the category list. Category-row selection (`useSalesPlanSelection`) is owned
 * here, not inside `useSalesPlan` or the table/card-list components, because it needs to be
 * visible to three siblings at once: `SalesPlanTable`/`SalesPlanCardList` (checkboxes),
 * `SelectionBar`/`SelectionBarMobile` (the design's `LSV9W`/`CwRNA`), and — in a later phase —
 * the approve mutation. The bar only renders once `selectedCount > 0` (see its spec); it isn't
 * part of the `hidden md:…`/`…md:hidden` breakpoint pair below because it's the same
 * conditional expression duplicated for each viewport's own bar component, not a single node
 * that's just hidden by CSS on the other breakpoint.
 *

 * Breakpoint switch (`hidden md:flex` / `flex md:hidden`, same convention as
 * `HeaderDesktop`/`HeaderMobile` in `shared/ui-kit/organisms/Header/Header.tsx`) rather than a
 * JS width check, so it switches purely on CSS with no layout flash: `KpiRow`/`SalesPlanTable`
 * on `md:` and up, `KpiGridMobile`/`SalesPlanCardList` below that. `KpiGridMobile` (unlike
 * `KpiRow`) drops the "Выручка · прогноз" card — matches `T0FMcE`'s `JvB6D` node 1:1, see that
 * component's comment.
 *
 * `direction` and `period` are both owned here (not inside `useSalesPlan`) so `PageHeader`'s
 * Direction Tabs and `PeriodPicker` can drive them — `useSalesPlan` switches its data source
 * (service vs. shop `salesPerformance` + category resolution, and now which month) internally
 * based on the `direction`/`period` it's given (see Фазу 4 in
 * docs/sales-plan-view-page/plan-sales-plan-view-page.md), so this page and the UI it renders
 * stay direction/period-agnostic. `period` starts at `DEFAULT_PERIOD` ('2026-06', the only
 * month with seeded `SalesPerformance` test data) and `useSalesPlanSelection`'s reset-on-change
 * already keys off both `direction` and `period` (see that hook), so switching month clears any
 * in-progress category selection the same way switching Сервис/Магазин does.
 *
 * "Изменить план" (`PageHeader`'s `onEditPlan`) opens `EditPlanModal`. Its edit set follows the
 * same selection-or-all rule the task asked for: `selection.selectedCount > 0` -> only the
 * selected rows, otherwise every row currently on screen for this `direction`/`period` — computed
 * here (not inside the modal) since it's the one place that already holds both `rows` and
 * `selection`. The button is disabled while there's nothing to edit (`!hasData`).
 *
 * Loading/empty/error (Фаза 5): `isInitialLoad`/`isRefreshing` follow the project convention
 * (`useServicesAnalytics`/`useDeals`, see frontend/CLAUDE.md) — `SpinnerPageLg` blocks the whole
 * block only while there's no data yet; a background refetch (e.g. switching direction to an
 * already-visited tab, or a window-focus revalidation) instead keeps the last rows on screen
 * with a light blur + inline "Обновление..." indicator. An empty (but not errored)
 * `salesPerformance` result renders `SalesPlanEmptyState` in place of both `SalesPlanTable` and
 * `SalesPlanCardList` — the same block covers both breakpoints. Only `2026-06` has seeded test
 * data, but note that any period *adjacent* to a month that already has a `SalesPlan` row stops
 * being empty the first time it's queried: the backend lazily backfills it (source
 * `PREVIOUS_MONTH`, see `salesPlanSourceSchema` in `contracts/commands/sales-plan.ts`) by copying
 * the preceding month's plan forward — verified against the running backend while building
 * `PeriodPicker` (e.g. querying `2026-07` once is enough to permanently create it, after which
 * it renders real rows, not the empty state). A period with no populated neighbor (e.g. `2026-09`
 * while `2026-08` stays untouched) stays genuinely empty.
 * `error` (from `ApiError.message`, see `shared/errors/apiError.ts`) renders as a banner; if a
 * background refetch fails while stale rows are still on screen, those rows stay visible below
 * the banner instead of being replaced by it.
 */
export function SalesPlanPage() {
    const [direction, setDirection] = useState<SalesDirection>(DEFAULT_DIRECTION)
    const [period, setPeriod] = useState<string>(DEFAULT_PERIOD)
    const { rows, totals, isInitialLoad, isRefreshing, error, dataVersion } = useSalesPlan(direction, period)
    const selection = useSalesPlanSelection(direction, period, rows)
    const periodLabel = formatPeriodLabel(period)
    const hasData = rows.length > 0
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const editRows = selection.selectedCount > 0 ? rows.filter((row) => selection.isSelected(row.plan.id)) : rows

    // "Утвердить выбранное" (Selection Bar) — approveRows is keyed on `direction` just like
    // useUpdateSalesPlanRows, so switching Сервис/Магазин swaps in the right endpoint
    // (POST .../sales/plan/approve under the matching domain prefix, see
    // useApproveSalesPlanRows). `selectedRows`/`hasApprovable` decide whether the button gets a
    // handler at all: if every currently-selected row is already APPROVED there's nothing to
    // approve, so `onApprove` is left `undefined` and SelectionBar/SelectionBarMobile render it
    // disabled with an explanatory title instead.
    const approveRows = useApproveSalesPlanRows(direction)
    const selectedRows = rows.filter((row) => selection.isSelected(row.plan.id))
    const hasApprovable = selectedRows.some((row) => row.plan.status !== 'APPROVED')

    function handleApprove() {
        const ids = selectedRows.map((row) => row.plan.id)
        if (ids.length === 0) return

        approveRows.mutate(ids, {
            onSuccess: () => {
                toast.success(ids.length === 1 ? 'Категория утверждена' : `Утверждено категорий: ${ids.length}`)
                selection.clear()
            },
            onError: (mutationError) => {
                toast.error('Не удалось утвердить план продаж', { description: mutationError.message })
            },
        })
    }

    return (
        <main className="flex flex-1 flex-col gap-4 bg-canvas px-4 py-5 md:px-7 md:py-6">
            <PageHeader
                direction={direction}
                onDirectionChange={setDirection}
                period={period}
                onPeriodChange={setPeriod}
                onEditPlan={() => setIsEditModalOpen(true)}
                editDisabled={!hasData}
            />

            <EditPlanModal
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                direction={direction}
                period={period}
                rows={editRows}
            />

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

                                {selection.selectedCount > 0 && (
                                    <>
                                        <SelectionBar
                                            selectedCount={selection.selectedCount}
                                            direction={direction}
                                            onClear={selection.clear}
                                            onApprove={hasApprovable ? handleApprove : undefined}
                                            isApproving={approveRows.isPending}
                                            className="hidden md:flex"
                                        />
                                        <SelectionBarMobile
                                            selectedCount={selection.selectedCount}
                                            onClear={selection.clear}
                                            onApprove={hasApprovable ? handleApprove : undefined}
                                            isApproving={approveRows.isPending}
                                            className="md:hidden"
                                        />
                                    </>
                                )}

                                {hasData ? (
                                    <>
                                        <SalesPlanTable
                                            rows={rows}
                                            className="hidden md:block"
                                            selectedIds={selection.selectedIds}
                                            onToggleRow={selection.toggleRow}
                                            onToggleAll={selection.toggleAll}
                                            isAllSelected={selection.isAllSelected}
                                            isIndeterminate={selection.isIndeterminate}
                                        />
                                        <SalesPlanCardList
                                            rows={rows}
                                            direction={direction}
                                            className="md:hidden"
                                            selectedIds={selection.selectedIds}
                                            onToggleRow={selection.toggleRow}
                                        />
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
