import { CircleCheck, Check, Loader2, X } from 'lucide-react'
import type { SalesDirection } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { pluralizeCategories } from '@/features/SalesPlan/model/format.ts'

const DIRECTION_LABEL: Record<SalesDirection, string> = {
    service: 'Сервис',
    shop: 'Магазин',
}

export type SelectionBarProps = {
    selectedCount: number
    direction: SalesDirection
    onClear: () => void
    /** `undefined` while all selected rows are already `APPROVED` — nothing left to approve, so
     * the button renders `disabled` instead of taking a handler (see `SalesPlanPage`, which only
     * passes a callback when at least one selected row is still `CREATED`). */
    onApprove?: () => void
    isApproving?: boolean
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `LSV9W` (`Selection Bar`, desktop) —
 * `brand-soft` fill + `brand-border` stroke pill (10px radius), `Selection Info` (`circle-check`
 * icon + "Выбрано N категорий направления «X»", `ok-ink`) on the left, `Selection Actions` on
 * the right. Only two of the design's three action buttons are built: `mLxaN` ("Btn Снять
 * выбор", secondary) and `u15rI` ("Btn Утвердить", primary) — `xLA5Q` ("Btn Удалить") is
 * explicitly out of scope (row deletion was not requested, see the task).
 *
 * "Утвердить" calls `onApprove` (wired in `SalesPlanPage` to `useApproveSalesPlanRows`) — it's
 * `disabled` only when there's nothing left to approve (`onApprove` is `undefined`, i.e. every
 * selected row is already `APPROVED`) or while the mutation is in flight.
 */
function SelectionBar({ selectedCount, direction, onClear, onApprove, isApproving, className }: SelectionBarProps) {
    return (
        <div
            data-slot="selection-bar"
            className={cn(
                'flex items-center justify-between gap-3 rounded-[10px] border border-brand-border bg-brand-soft px-4 py-2.5',
                className,
            )}
        >
            <div className="flex items-center gap-2.5">
                <CircleCheck className="size-4 shrink-0 text-ok-ink" />
                <span className="font-ui text-[13px] font-medium text-ok-ink">
                    Выбрано {selectedCount} {pluralizeCategories(selectedCount)} направления «
                    {DIRECTION_LABEL[direction]}»
                </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onClear}
                    className="text-ink-muted [&_svg]:text-ink-muted"
                >
                    <X />
                    Снять выбор
                </Button>
                <Button
                    type="button"
                    onClick={onApprove}
                    disabled={!onApprove || isApproving}
                    title={onApprove ? undefined : 'Выбранные категории уже утверждены'}
                >
                    {isApproving ? <Loader2 className="animate-spin" /> : <Check />}
                    Утвердить выбранное
                </Button>
            </div>
        </div>
    )
}

export { SelectionBar }
