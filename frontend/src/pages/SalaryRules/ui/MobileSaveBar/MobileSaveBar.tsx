import { Check, History, Loader2 } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'

export type MobileSaveBarProps = {
    hintText: string
    onSave: () => void
    canSave: boolean
    isSubmitting: boolean
    onCancel: () => void
    canCancel: boolean
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `YOb5N` (instance of `ERP/Mobile/Sheet
 * Actions`) — the mobile-only sticky action bar at the very bottom of both `IScAL` (Сервис) and
 * `AmfHy` (Магазин): a centered `history` icon + hint line ("Черновик · схема ещё не сохранена" /
 * the success banner's own text once saved), then a fixed-width "Отмена" + full-width "Сохранить
 * схему" button row.
 *
 * Rendered as the LAST child of `<main>` via `ui/Layout`'s `mobileBar` slot, with `mt-auto sticky
 * bottom-[var(--bottom-nav-h,4.5rem)]` at the call site (`mediator/SalaryRulesCreate.tsx`) —
 * `mt-auto` lets it consume any leftover height in `main`'s `flex-1` column so it still sits flush
 * with the viewport bottom on short pages, and the `bottom-[var(--bottom-nav-h,...)]` offset stacks
 * it directly above the global `BottomNav` (`app/BottomNav.tsx`) instead of `bottom-0`, which would
 * render it in the exact same spot as `BottomNav` — `BottomNav`'s own sticky containing block is
 * the whole `app/Layout.tsx` wrapper (not just `main`'s box), so it stays pinned to the viewport
 * bottom for virtually the entire scroll range, not only once a page reaches its end. See
 * `app/Layout.tsx`'s comment for how `--bottom-nav-h` is measured and published, and
 * `ui/Layout/Layout.tsx` for the surrounding structure this depends on.
 *
 * "Отмена" doesn't discard already-*confirmed* rules (those represent real, deliberate work) — it
 * only resets Step 1's target selection (`targetId`/`schemaName`, owned by
 * `model/useSchemaTarget.ts`), the closest non-destructive equivalent of the mockup's top-bar "×"
 * (which this routed page has no modal to back out of). Disabled once there's nothing to reset.
 */
export function MobileSaveBar({
    hintText,
    onSave,
    canSave,
    isSubmitting,
    onCancel,
    canCancel,
    className,
}: MobileSaveBarProps) {
    return (
        <div
            data-slot="salary-rules-mobile-save-bar"
            className={cn(
                'flex flex-col gap-2.5 border-t border-hairline bg-surface px-4 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]',
                className,
            )}
        >
            <div className="flex items-center justify-center gap-1.5">
                <History className="size-[13px] shrink-0 text-ink-muted" />
                <span className="truncate font-ui text-[11.5px] text-ink-muted">{hintText}</span>
            </div>
            <div className="flex items-center gap-2.5">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={!canCancel}>
                    Отмена
                </Button>
                <Button type="button" onClick={onSave} disabled={!canSave} className="flex-1">
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Check />}
                    Сохранить схему
                </Button>
            </div>
        </div>
    )
}
