import { Pencil } from 'lucide-react'
import type { SalesDirection } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { PeriodPicker } from '@/features/SalesPlan'

const DIRECTIONS: { value: SalesDirection; label: string }[] = [
    { value: 'service', label: 'Сервис' },
    { value: 'shop', label: 'Магазин' },
]

export type PageHeaderProps = {
    direction: SalesDirection
    onDirectionChange: (direction: SalesDirection) => void
    period: string
    onPeriodChange: (period: string) => void
    onEditPlan: () => void
    editDisabled?: boolean
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, nodes `cNvpa` (`Page Header`) + `jvP4H`
 * (`Direction Row`), stacked with the Content frame's own 16px gap (`ydHeY`).
 *
 * `cNvpa`: Title Block (Montserrat 26/700 title + 13px muted subtitle) on the left, a
 * `brand-soft`-filled "Период открыт" pill (dot + 13px `ok-ink` text, node `UhryL`) on the
 * right. The period-open/closed state isn't fetched by this page (no `AccountingPeriod`
 * query — see Фаза 2 of docs/sales-plan-view-page/plan-sales-plan-view-page.md), so it's
 * fixed to "открыт" for now.
 *
 * `jvP4H`: a segmented Direction Tabs control (`MjG42`, `hairline`-filled track, active tab
 * a white pill — Сервис/Магазин) and, right-aligned, `Kj0bs`/"Period Controls" — the Period
 * Chip (`jKZCJ`, ref `ERP/Atom/Chip`), now `PeriodPicker` (see that component's own comment
 * for why its dropdown has no Pencil counterpart) rather than a static label, plus, gap 10 next
 * to it, "Btn Изменить план" (`JjkSX` desktop / `e1D3nB` mobile, both `ERP/Atom/Button`
 * instances) — opens `EditPlanModal` via `onEditPlan`.
 * Kept in this one shared row (rather than mirroring the .pen file's separate mobile-only
 * full-width button row under `T0FMcE`'s Direction Tabs) so mobile/desktop keep sharing this
 * single `PageHeader`, consistent with how this component already diverges from a literal
 * per-breakpoint split (see the file's `SalesPlanPage` render, which mounts one `PageHeader`
 * for both breakpoints) — `flex-wrap` lets the pair drop to its own line on narrow viewports.
 */
function PageHeader({ direction, onDirectionChange, period, onPeriodChange, onEditPlan, editDisabled, className }: PageHeaderProps) {
    return (
        <div data-slot="sales-plan-page-header" className={cn('flex flex-col gap-4', className)}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="font-display text-[26px] font-bold tracking-[-0.4px] text-ink">План продаж</h1>
                    <p className="font-ui text-sm text-ink-muted">План, факт и прогноз продаж по категориям</p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-soft px-3 py-[7px]">
                    <span className="size-[7px] rounded-full bg-brand-strong" />
                    <span className="font-ui text-[13px] font-medium text-ok-ink">Период открыт</span>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-1 rounded-[10px] bg-hairline p-1" role="tablist" aria-label="Направление">
                    {DIRECTIONS.map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={direction === value}
                            onClick={() => onDirectionChange(value)}
                            className={cn(
                                'rounded-lg px-3 py-1.5 font-ui text-[13px] transition-colors select-none',
                                direction === value
                                    ? 'bg-surface font-semibold text-ink shadow-sm'
                                    : 'font-medium text-ink-muted hover:text-ink',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <PeriodPicker period={period} onPeriodChange={onPeriodChange} />
                    <Button type="button" onClick={onEditPlan} disabled={editDisabled}>
                        <Pencil />
                        Изменить план
                    </Button>
                </div>
            </div>
        </div>
    )
}

export { PageHeader }
