import { CornerDownRight } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import { CellProgress } from '@/shared/ui-kit/molecules/CellProgress'
import { CellStatus } from '@/shared/ui-kit/molecules/CellStatus'
import { ColumnHeader } from '@/shared/ui-kit/molecules/ColumnHeader'
import type { SalesPlanRow } from '@/features/SalesPlan/model/useSalesPlan.ts'
import { formatCurrency } from '@/features/SalesPlan/model/format.ts'

// Пиксельные ширины 1:1 с колонками из дизайна (`XBPIW` Header Row): План 170 / Факт 180 /
// Прогноз 180 / Осталось 160 / Выполнение 240 / Статус 116. Колонка выбора строк (44px,
// см. ниже) переносится 1:1; "Действия" (72px, out of scope — правка/удаление строк не
// запрошены) — нет, её ширину по-прежнему забирает колонка "Категория" (`fill_container`
// в дизайне и здесь).
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
    /** `row.plan.id` -> selected. From `useSalesPlanSelection`. */
    selectedIds: Set<string>
    onToggleRow: (id: string) => void
    onToggleAll: () => void
    isAllSelected: boolean
    isIndeterminate: boolean
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `UWuak` (`Plan Table`) — Header Row
 * (`XBPIW`) + one "Entity" row per category (`xjpCz`, `ELjZz`, ...), each 60px tall with two
 * stacked metric lines (`GxX7C/Metrics`, gap 3): "Line Выручка" (14px/500 ink — Категория,
 * План, Факт, Прогноз, Осталось, Выполнение) and, right below it, a secondary "Line Маржа"
 * (12px muted, `corner-down-right` branch icon) with the same columns for `margin`. Rows
 * alternate `row-selected`/`surface` fill for zebra striping (`xjpCz` #F6FDF9, `ELjZz`
 * #FFFFFF, `ag3FF` #F6FDF9, ...) — despite the token's name this is a plain zebra tint in
 * the design, unrelated to the row-selection checkboxes below.
 *
 * Selection checkboxes (`WWw3l`/"H sel" in the header, `Q2R6J`/"Cell Select" per row, both a
 * leading 44px column) are implemented; the "Действия" column (edit/delete icons) and row
 * deletion are not — neither was requested (see the task this phase was built from).
 */
function SalesPlanTable({ rows, className, selectedIds, onToggleRow, onToggleAll, isAllSelected, isIndeterminate }: SalesPlanTableProps) {
    return (
        <div
            data-slot="sales-plan-table"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            <div className="overflow-x-auto">
                <div className="min-w-[1084px]">
                    <div className="flex items-center border-b border-hairline bg-canvas">
                        <div className="flex h-10 w-11 shrink-0 items-center justify-center">
                            <Checkbox
                                checked={isIndeterminate ? 'indeterminate' : isAllSelected}
                                onCheckedChange={onToggleAll}
                                aria-label="Выбрать все категории"
                            />
                        </div>
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
                            key={row.plan.id}
                            row={row}
                            zebra={index % 2 === 0}
                            selected={selectedIds.has(row.plan.id)}
                            onToggle={() => onToggleRow(row.plan.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function SalesPlanTableRow({
    row,
    zebra,
    selected,
    onToggle,
}: {
    row: SalesPlanRow
    zebra: boolean
    selected: boolean
    onToggle: () => void
}) {
    return (
        <div
            data-slot="sales-plan-table-row"
            className={cn('flex items-center border-b border-hairline last:border-b-0', zebra ? 'bg-row-selected' : 'bg-surface')}
        >
            <div className="flex w-11 shrink-0 items-center justify-center self-stretch">
                <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Выбрать категорию ${row.categoryName}`} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-[3px] py-2">
                <div className="flex items-center">
                    <span
                        className="min-w-[200px] flex-1 truncate px-3 font-ui text-sm font-medium text-ink"
                        title={row.orderTypeNames.length > 0 ? `Типы заказов: ${row.orderTypeNames.join(', ')}` : undefined}
                    >
                        {row.categoryName}
                        {row.orderTypeNames.length > 0 && (
                            <span className="ml-1.5 font-normal text-ink-muted">· {row.orderTypeNames.join(', ')}</span>
                        )}
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
