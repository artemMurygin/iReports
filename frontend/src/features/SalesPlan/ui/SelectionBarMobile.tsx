import { CircleCheck, Check, Loader2 } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { pluralizeCategories } from '@/features/SalesPlan/model/format.ts'

export type SelectionBarMobileProps = {
    selectedCount: number
    onClear: () => void
    /** `undefined` while all selected rows are already `APPROVED` — see `SelectionBar`'s prop doc. */
    onApprove?: () => void
    isApproving?: boolean
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `CwRNA` (`ERP/Mobile/Selection Bar`) — the
 * mobile counterpart of `SelectionBar`, stacked instead of a single row: `Info` (`circle-check`
 * + "Выбрано N категорий" on the left, a plain "Снять выбор" text link on the right, no
 * direction wording — unlike desktop, the design's mobile card doesn't restate the direction)
 * above a full-width `Actions` row. The design's `Actions` row has two buttons
 * (`Adaf5`/"Btn Primary" Утвердить + `Sx1oF`/"Btn Danger" Удалить); only Утвердить is built
 * (see `SelectionBar`'s comment on why Удалить is out of scope) — with the delete button gone,
 * Утвердить takes the full row width instead of half.
 *
 * Same as desktop: "Утвердить" calls `onApprove`, disabled only when there's nothing left to
 * approve or while the mutation is in flight.
 */
function SelectionBarMobile({ selectedCount, onClear, onApprove, isApproving, className }: SelectionBarMobileProps) {
    return (
        <div
            data-slot="selection-bar-mobile"
            className={cn('flex flex-col gap-2.5 rounded-xl border border-brand-border bg-brand-soft p-3', className)}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <CircleCheck className="size-[15px] shrink-0 text-ok-ink" />
                    <span className="truncate font-ui text-[13px] font-semibold text-ok-ink">
                        Выбрано {selectedCount} {pluralizeCategories(selectedCount)}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClear}
                    className="shrink-0 font-ui text-xs font-medium text-ink-muted hover:text-ink"
                >
                    Снять выбор
                </button>
            </div>

            <Button
                type="button"
                onClick={onApprove}
                disabled={!onApprove || isApproving}
                title={onApprove ? undefined : 'Выбранные категории уже утверждены'}
                className="w-full"
            >
                {isApproving ? <Loader2 className="animate-spin" /> : <Check />}
                Утвердить выбранное
            </Button>
        </div>
    )
}

export { SelectionBarMobile }
