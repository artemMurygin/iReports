import { useState } from 'react'
import type { SalesDirection } from 'ireports-contracts'

import { DEFAULT_DIRECTION, KpiRow, SalesPlanTable, formatPeriodLabel, useSalesPlan } from '@/features/SalesPlan'
import { ErrorLayout } from '@/shared/ui/ErrorLayout.tsx'
import { SpinnerPageLg } from '@/shared/ui/SpinnerPageLg'

import { PageHeader } from './PageHeader.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, node `x2soj` (`План продаж · Список`) —
 * `Main`/`Content` frame (`br4nr`/`ydHeY`): `canvas` background, 24/28 padding, 16px gap
 * between `PageHeader`, `KpiRow`, and the `SalesPlanTable`. The design's `Selection Bar`
 * (`LSV9W`, bulk-action bar for checked rows) has no place here — this is a view-only page
 * with no row selection (see Фаза 2 in docs/sales-plan-view-page/plan-sales-plan-view-page.md).
 *
 * `direction` is owned here (not inside `useSalesPlan`) so the Direction Tabs in
 * `PageHeader` can drive it — Фаза 2 only wires up `service`; switching to `shop` updates
 * the tab's visual state and is passed through to `useSalesPlan`, but doesn't fetch new
 * data yet (that's Фаза 4), so it renders the same empty-state as "no data for this
 * period" until then.
 */
export function SalesPlanPage() {
    const [direction, setDirection] = useState<SalesDirection>(DEFAULT_DIRECTION)
    const { rows, totals, isLoading, error, period } = useSalesPlan(direction)
    const periodLabel = formatPeriodLabel(period)

    return (
        <main className="flex flex-1 flex-col gap-4 bg-canvas px-7 py-6">
            <PageHeader direction={direction} onDirectionChange={setDirection} periodLabel={periodLabel} />

            {error && <ErrorLayout error={error} />}

            {isLoading ? (
                <SpinnerPageLg label="Загрузка данных..." />
            ) : (
                <>
                    <KpiRow totals={totals} periodLabel={periodLabel} />

                    {rows.length === 0 && !error ? (
                        <div className="rounded-xl border border-hairline bg-surface px-6 py-16 text-center font-ui text-sm text-ink-muted">
                            {direction === 'shop'
                                ? 'Направление «Магазин» пока не подключено к этой странице.'
                                : `Нет данных плана продаж за ${periodLabel}.`}
                        </div>
                    ) : (
                        <SalesPlanTable rows={rows} />
                    )}
                </>
            )}
        </main>
    )
}
