import { Calendar, ChevronLeft, ChevronRight, Lock } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover.tsx'
import { formatPeriodLabel, isValidPeriod, shiftPeriod } from '@/features/SalesPlan/model/format.ts'

export type PeriodPickerProps = {
    period: string
    onPeriodChange: (period: string) => void
    /** Расчётный период выбранного месяца закрыт (Фаза 4 docs/payroll-closing-and-accrual):
     * чип меняет иконку календаря на замок c `info-ink` — «признак закрытого месяца в
     * PeriodPicker» из плана; сам выбор месяца остаётся доступным. */
    isClosed?: boolean
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `jKZCJ`/`sVWu5` (`ERP/Atom/Chip`, "Период:
 * <месяц год>") — the trigger below reproduces that chip 1:1 (`Calendar` icon, `hairline`
 * border, `surface` fill, same padding/typography as the static chip it replaces in
 * `PageHeader`). The dropdown *content* itself has no Pencil counterpart — the design only
 * specifies the chip as a static label, not an open state — so its layout (prev/next-month
 * arrows around the current label) is this task's own addition, built from existing UI Kit
 * atoms (`IconButton`) and tokens rather than inventing a new one-off visual language.
 *
 * Built on `shared/ui/popover.tsx` (the shadcn/radix `Popover` primitive, still on the old
 * token set) rather than a new UI Kit organism — this is the one instance across the app where
 * reusing it was pre-approved (see task instructions): a single internal dropdown-with-arrows
 * control, not a reusable piece of business UI, so a full UI Kit component isn't warranted. Its
 * `PopoverContent` classes are fully overridden with UI Kit tokens (`surface`/`hairline`/`ink`)
 * so it still looks native to this page rather than the old shadcn palette.
 *
 * `apply()` runs every arrow-shifted candidate through `isValidPeriod` (`model/format.ts`)
 * before calling `onPeriodChange`, as defense in depth. `isValidPeriod` mirrors
 * `periodSchema`'s regex rather than importing the schema itself: importing any *runtime*
 * (non-type-only) value from `ireports-contracts` — this would be the first one anywhere in
 * `frontend/src` — throws in the Vite dev server ("does not provide an export named ..."),
 * because the package is resolved as a symlinked workspace source tree rather than a
 * prebundled `node_modules` dependency, so Vite never runs its CJS→ESM interop transform on
 * it; every existing usage elsewhere is `import type`, which TypeScript erases entirely and so
 * never actually hits that path. Fixing the package's build/resolution is out of this task's
 * scope (frontend-only) and out of proportion to one regex, so this duplicates the literal
 * pattern instead — same precedent as `work-schedule.ts`'s own `workScheduleMonthSchema`
 * rather than importing this one.
 *
 * Deliberately uncontrolled `Popover` (no `open` state of our own) — arrow clicks are meant to
 * be repeatable without the dropdown closing after each one; it closes only via Radix's built-in
 * outside-click/Escape handling.
 */
function PeriodPicker({ period, onPeriodChange, isClosed = false, className }: PeriodPickerProps) {
    function apply(candidate: string) {
        if (!isValidPeriod(candidate)) return
        onPeriodChange(candidate)
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    title={isClosed ? 'Месяц закрыт' : undefined}
                    className={cn(
                        'flex shrink-0 items-center gap-2 rounded-[7px] border border-hairline bg-surface px-2.5 py-[5px] transition-colors hover:bg-canvas',
                        className,
                    )}
                >
                    {isClosed ? (
                        <Lock className="size-[13px] text-info-ink" />
                    ) : (
                        <Calendar className="size-[13px] text-ink-muted" />
                    )}
                    <span className="font-ui text-xs font-medium text-ink">Период: {formatPeriodLabel(period)}</span>
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="end"
                className="w-64 gap-3 rounded-[10px] border border-hairline bg-surface p-3 text-ink shadow-lg ring-0"
            >
                <div className="flex items-center justify-between gap-2">
                    <IconButton type="button" onClick={() => apply(shiftPeriod(period, -1))} aria-label="Предыдущий месяц">
                        <ChevronLeft />
                    </IconButton>
                    <span className="font-ui text-[13px] font-semibold text-ink tabular-nums">{formatPeriodLabel(period)}</span>
                    <IconButton type="button" onClick={() => apply(shiftPeriod(period, 1))} aria-label="Следующий месяц">
                        <ChevronRight />
                    </IconButton>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export { PeriodPicker }
