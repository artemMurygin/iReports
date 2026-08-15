import { CornerDownRight } from 'lucide-react'
import type { SalesPlanStatus } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import { CellStatus } from '@/shared/ui-kit/molecules/CellStatus'

/**
 * Pencil: design/sallary-first-iteration.pen, node `i4Qz8y` (`ERP/Mobile/Plan Card`) — a
 * 358px-wide card (`surface` fill, 12px radius, 1px hairline border, 14px padding, 12px gap):
 * `Top` (selection checkbox + Category name + Status badge) -> `Values` (План/Факт/Выполнение,
 * three columns) -> a full-width revenue `Progress` bar -> `Margin Row` (branch icon + "Маржа"
 * label, right-aligned values + a small flat-grey progress bar + percent).
 *
 * This is the mobile-list counterpart of `SalesPlanTable`'s row (`UWuak`'s "Entity" rows) —
 * same two metric lines (revenue + margin), stacked instead of columned. `Top`'s selection
 * checkbox (`IRX80`) is implemented; the "More" icon-button (`U5ikIX`, edit/delete) is not —
 * row mutation beyond selection was not requested.
 *
 * Values are passed in pre-formatted (`planLabel`/`factLabel`/`marginRangeLabel`), matching
 * the same convention as `KpiCard`'s `value` prop — this is `shared/ui-kit`, which per
 * frontend/CLAUDE.md must stay free of business logic (currency formatting lives in
 * `features/SalesPlan/model/format.ts`).
 */
function progressToneClassName(percent: number) {
    if (percent >= 100) return 'bg-brand-strong'
    if (percent >= 70) return 'bg-[#7fcb4b]'
    if (percent >= 40) return 'bg-warn'
    return 'bg-danger'
}

export type PlanCardProps = {
    categoryName: string
    status: SalesPlanStatus
    /** Pre-formatted "План, ₽" value, e.g. "1 450 000" (no currency suffix — the column label already carries "₽"). */
    planLabel: string
    /** Pre-formatted "Факт, ₽" value, same convention as `planLabel`. */
    factLabel: string
    /** Revenue completion percent (0-100+) — drives both the "Выполнение" number and the progress bar fill. */
    percentCompletion: number
    /** Pre-formatted margin range, e.g. "435 400 из 580 000". */
    marginRangeLabel: string
    /** Margin completion percent (0-100+) — drives the small margin progress bar and its trailing label. */
    marginPercent: number
    /** Selection checkbox state — omitted `onSelectedChange` hides the checkbox entirely. */
    selected?: boolean
    onSelectedChange?: (selected: boolean) => void
    className?: string
}

function PlanCard({
    categoryName,
    status,
    planLabel,
    factLabel,
    percentCompletion,
    marginRangeLabel,
    marginPercent,
    selected = false,
    onSelectedChange,
    className,
}: PlanCardProps) {
    const filledWidth = Math.max(0, Math.min(100, percentCompletion))
    const marginFilledWidth = Math.max(0, Math.min(100, marginPercent))

    return (
        <div
            data-slot="plan-card"
            className={cn('flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-3.5 font-ui', className)}
        >
            <div className="flex items-center gap-2.5">
                {onSelectedChange && (
                    <Checkbox checked={selected} onCheckedChange={onSelectedChange} aria-label={`Выбрать категорию ${categoryName}`} />
                )}
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{categoryName}</span>
                <CellStatus status={status} />
            </div>

            <div className="flex items-center gap-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[11px] text-ink-muted">План, ₽</span>
                    <span className="truncate font-display text-base font-semibold tracking-[-0.3px] text-ink">
                        {planLabel}
                    </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[11px] text-ink-muted">Факт, ₽</span>
                    <span className="truncate font-display text-base font-semibold tracking-[-0.3px] text-ink">
                        {factLabel}
                    </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[11px] text-ink-muted">Выполнение</span>
                    <span className="font-display text-base font-bold tracking-[-0.3px] text-ink">
                        {Math.round(percentCompletion)}%
                    </span>
                </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-hairline">
                <div
                    className={cn('h-full rounded-full', progressToneClassName(filledWidth))}
                    style={{ width: `${filledWidth}%` }}
                />
            </div>

            <div className="flex items-center justify-between gap-2">
                <div className="flex shrink-0 items-center gap-1.5">
                    <CornerDownRight className="size-3 shrink-0 text-ink-faint" />
                    <span className="text-xs text-ink-muted">Маржа</span>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs text-ink-muted">{marginRangeLabel}</span>
                    <div className="h-[5px] w-14 shrink-0 overflow-hidden rounded-full bg-hairline">
                        <div className="h-full rounded-full bg-[#c9c9cc]" style={{ width: `${marginFilledWidth}%` }} />
                    </div>
                    <span className="shrink-0 text-xs font-medium text-ink-muted">{Math.round(marginPercent)}%</span>
                </div>
            </div>
        </div>
    )
}

export { PlanCard }
