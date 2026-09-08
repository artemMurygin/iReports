import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { CatalogCategoryResponse } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'

import { useCategoryOverlay } from '../model/useCategoryOverlay.ts'

import { CATEGORY_TRIGGER_CLASS, SHEET_SEARCH_CLASSES, SHEET_TREE_CLASSES } from './categoryOverlay.ts'
import { CategorySearchInput } from './CategorySearchInput.tsx'
import { CategoryTreeBody } from './CategoryTreeBody.tsx'

export type CategoryBottomSheetProps = {
    value: string | null
    onValueChange: (value: string | null) => void
    categories: CatalogCategoryResponse[]
    isLoading?: boolean
    error?: string | null
    className?: string
}

const SELECTED_MARK = <Check className="size-4 shrink-0 text-brand-strong" />

/**
 * Pencil: design/sallary-first-iteration.pen, node `xF4KU` (`Категория товара · Меню (мобильный)`)
 * — the `md:hidden` counterpart of `CategoryCombobox.tsx`'s popover: same trigger button
 * (`CATEGORY_TRIGGER_CLASS`), but opens a bottom sheet (radix `Dialog`, slide-in-from-bottom,
 * rounded top corners) instead of a `Popover`, with a search box, the same tree (pinned "Все
 * категории" row + `GET /v1/shop/warehouse/catalog` nodes with expand/collapse), and a
 * "Сбросить"/"Применить" footer.
 *
 * Unlike the desktop popover — where tapping a row commits immediately — this sheet stages the
 * pick in local `staged` state and only calls `onValueChange` when "Применить" is pressed
 * ("Сбросить" clears `staged` back to "Все категории" without closing, so a misstap is easy to
 * undo before committing). `staged` re-seeds from the real `value` on the closed→open transition
 * (same "adjusting state during render" convention as `EditPlanModal`'s `wasOpen` check, not a
 * `useEffect`), so reopening the sheet after a cancelled edit starts from the last committed value,
 * not a stale in-progress one.
 *
 * Same tree helpers (`core/model/catalogTree.ts`), the same shared tree/search markup
 * (`CategorySearchInput.tsx`/`CategoryTreeBody.tsx`) and the same documented product-count gap as `CategoryCombobox.tsx`
 * (no count field on the catalog endpoint) — see that file's comment.
 */
export function CategoryBottomSheet({
    value,
    onValueChange,
    categories,
    isLoading,
    error,
    className,
}: CategoryBottomSheetProps) {
    const [staged, setStaged] = useState<string | null>(value)

    // Открытие/поиск/развёрнутые узлы и подпись выбранной категории — общий с popover-ом стейт
    // (`../model/useCategoryOverlay.ts`); своим здесь остаётся только `staged`, который
    // пере-засевается из реального `value` на переходе «закрыт → открыт» (колбэк `onOpen`).
    const {
        open,
        setOpen,
        query,
        setQuery,
        expandedIds,
        selectedLabel,
        searchResults,
        toggleExpanded,
        handleOpenChange,
    } = useCategoryOverlay({ value, categories, onOpen: () => setStaged(value) })

    function applyStaged() {
        onValueChange(staged)
        setOpen(false)
    }

    return (
        <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
            <DialogPrimitive.Trigger asChild>
                <button type="button" disabled={isLoading} className={cn(CATEGORY_TRIGGER_CLASS, className)}>
                    <span className="truncate">
                        {isLoading ? 'Загрузка...' : error ? 'Не удалось загрузить' : selectedLabel}
                    </span>
                    <ChevronDown className="size-[15px] shrink-0 text-ink-muted" />
                </button>
            </DialogPrimitive.Trigger>

            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
                <DialogPrimitive.Content
                    className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-t-2xl border-t border-hairline bg-surface shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-8"
                    aria-describedby={undefined}
                >
                    <DialogPrimitive.Title className="sr-only">Категория товара</DialogPrimitive.Title>

                    <CategorySearchInput query={query} onQueryChange={setQuery} classes={SHEET_SEARCH_CLASSES} />

                    <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
                        <CategoryTreeBody
                            categories={categories}
                            query={query}
                            searchResults={searchResults}
                            selectedId={staged}
                            expandedIds={expandedIds}
                            onToggleExpanded={toggleExpanded}
                            onSelect={setStaged}
                            mark={SELECTED_MARK}
                            classes={SHEET_TREE_CLASSES}
                        />
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-hairline p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        <button
                            type="button"
                            onClick={() => setStaged(null)}
                            className="shrink-0 font-ui text-sm font-semibold text-ok-ink"
                        >
                            Сбросить
                        </button>
                        <Button type="button" onClick={applyStaged} className="flex-1">
                            <Check />
                            Применить
                        </Button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}
