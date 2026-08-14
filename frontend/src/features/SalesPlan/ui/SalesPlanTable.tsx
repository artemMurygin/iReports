import { CornerDownRight } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { CellProgress } from '@/shared/ui-kit/molecules/CellProgress'
import { CellStatus } from '@/shared/ui-kit/molecules/CellStatus'
import { ColumnHeader } from '@/shared/ui-kit/molecules/ColumnHeader'
import type { SalesPlanRow } from '@/features/SalesPlan/model/useSalesPlan.ts'
import { formatCurrency } from '@/features/SalesPlan/model/format.ts'

// Пиксельные ширины 1:1 с колонками из дизайна (`XBPIW` Header Row): План 170 / Факт 180 /
// Прогноз 180 / Осталось 160 / Выполнение 240 / Статус 116. Колонки выбора строк (44) и
// действий (72) не переносятся — страница view-only (см. Фазу 2 в
// docs/sales-plan-view-page/plan-sales-plan-view-page.md), поэтому их ширину забирает
// колонка "Категория" (`fill_container` в дизайне и здесь).
const COLUMN_WIDTH = {
    plan: 'w-[170px]',
    fact: 'w-[180px]',
    forecast: 'w-[180px]',
    remaining: 'w-[160px]',
    progress: 'w-[240px]',
    status: 'w-[116px]',
}

export type SalesPlanTableProps = {
    rows: SalesPlanRow[]
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `UWuak` (`Plan Table`) — Header Row
 * (`XBPIW`) + one "Entity" row per category (`xjpCz`, `ELjZz`, ...), each 60px tall with two
 * stacked metric lines (`GxX7C/Metrics`, gap 3): "Line Выручка" (14px/500 ink — Категория,
 * План, Факт, Прогноз, Осталось, Выполнение) and, right below it, a secondary "Line Маржа"
 * (12px muted, `corner-down-right` branch icon) with the same columns for `margin`. Rows
 * alternate `row-selected`/`surface` fill for zebra striping (`xjpCz` #F6FDF9, `ELjZz`
 * #FFFFFF, `ag3FF` #F6FDF9, ...) — despite the token's name this is a plain zebra tint in
 * the design, unrelated to the (out-of-scope) row-selection checkboxes.
 *
 * Selection checkboxes, the "Действия" column (edit/delete icons), and the Selection Bar are
 * intentionally not implemented — this page is view-only (see Фаза 2 in
 * docs/sales-plan-view-page/plan-sales-plan-view-page.md).
 */
function SalesPlanTable({ rows, className }: SalesPlanTableProps) {
    return (
        <div
            data-slot="sales-plan-table"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            <div className="overflow-x-auto">
                <div className="min-w-[1040px]">
                    <div className="flex items-center border-b border-hairline bg-canvas">
                        <ColumnHeader label="Категория" className="min-w-[200px] flex-1" />
                        <ColumnHeader label="План, ₽" align="end" className={COLUMN_WIDTH.plan} />
                        <ColumnHeader label="Факт, ₽" align="end" emphasis className={COLUMN_WIDTH.fact} />
                        <ColumnHeader label="Прогноз, ₽" align="end" className={COLUMN_WIDTH.forecast} />
                        <ColumnHeader label="Осталось, ₽" align="end" className={COLUMN_WIDTH.remaining} />
                        <ColumnHeader label="Выполнение" className={COLUMN_WIDTH.progress} />
                        <ColumnHeader label="Статус" className={COLUMN_WIDTH.status} />
                    </div>

                    {rows.map((row, index) => (
                        <SalesPlanTableRow
                            key={`${row.direction}-${row.department}-${row.category ?? 'null'}`}
                            row={row}
                            zebra={index % 2 === 0}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function SalesPlanTableRow({ row, zebra }: { row: SalesPlanRow; zebra: boolean }) {
    return (
        <div
            data-slot="sales-plan-table-row"
            className={cn('flex items-center border-b border-hairline last:border-b-0', zebra ? 'bg-row-selected' : 'bg-surface')}
        >
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-[3px] py-2">
                <div className="flex items-center">
                    <span className="min-w-[200px] flex-1 truncate px-3 font-ui text-sm font-medium text-ink">
                        {row.categoryName}
                    </span>
                    <span className={cn('shrink-0 truncate px-3 text-right font-ui text-sm font-medium text-ink', COLUMN_WIDTH.plan)}>
                        {formatCurrency(row.plan.turnover)}
                    </span>
                    <span className={cn('shrink-0 truncate px-3 text-right font-ui text-sm font-medium text-ink', COLUMN_WIDTH.fact)}>
                        {formatCurrency(row.fact.turnover)}
                    </span>
                    <span
                        className={cn('shrink-0 truncate px-3 text-right font-ui text-sm font-medium text-ink', COLUMN_WIDTH.forecast)}
                    >
                        {formatCurrency(row.prognose.turnover)}
                    </span>
                    <span
                        className={cn('shrink-0 truncate px-3 text-right font-ui text-sm font-medium text-ink', COLUMN_WIDTH.remaining)}
                    >
                        {formatCurrency(row.remaining)}
                    </span>
                    <div className={cn('shrink-0 px-3', COLUMN_WIDTH.progress)}>
                        <CellProgress percent={row.fact.percentCompletion} />
                    </div>
                </div>

                <div className="flex items-center">
                    <span className="flex min-w-[200px] flex-1 items-center gap-1.5 truncate px-3 font-ui text-xs text-ink-muted">
                        <CornerDownRight className="size-3 shrink-0 text-ink-faint" />
                        Маржа
                    </span>
                    <span className={cn('shrink-0 truncate px-3 text-right font-ui text-xs text-ink-muted', COLUMN_WIDTH.plan)}>
                        {formatCurrency(row.plan.margin)}
                    </span>
                    <span className={cn('shrink-0 truncate px-3 text-right font-ui text-xs text-ink-muted', COLUMN_WIDTH.fact)}>
                        {formatCurrency(row.fact.margin)}
                    </span>
                    <span className={cn('shrink-0 truncate px-3 text-right font-ui text-xs text-ink-muted', COLUMN_WIDTH.forecast)}>
                        {formatCurrency(row.prognose.margin)}
                    </span>
                    <span className={cn('shrink-0 truncate px-3 text-right font-ui text-xs text-ink-muted', COLUMN_WIDTH.remaining)}>
                        {formatCurrency(row.remainingMargin)}
                    </span>
                    <div className={cn('shrink-0 px-3', COLUMN_WIDTH.progress)}>
                        <CellProgress percent={row.marginPercent} size="compact" />
                    </div>
                </div>
            </div>

            <div className={cn('flex shrink-0 items-center px-3', COLUMN_WIDTH.status)}>
                <CellStatus status={row.plan.status} />
            </div>
        </div>
    )
}

export { SalesPlanTable }
