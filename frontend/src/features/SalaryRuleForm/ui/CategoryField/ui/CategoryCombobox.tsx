import { ChevronDown } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import type { CatalogCategoryResponse } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import { useCategoryOverlay } from '../model/useCategoryOverlay.ts'

import { CATEGORY_TRIGGER_CLASS, POPOVER_SEARCH_CLASSES, POPOVER_TREE_CLASSES } from './categoryOverlay.ts'
import { CategorySearchInput } from './CategorySearchInput.tsx'
import { CategoryTreeBody } from './CategoryTreeBody.tsx'

export type CategoryComboboxProps = {
    value: string | null
    onValueChange: (value: string | null) => void
    categories: CatalogCategoryResponse[]
    isLoading?: boolean
    error?: string | null
    className?: string
}

const SELECTED_MARK = <div className="size-[7px] shrink-0 rounded-full bg-brand-strong" />

/**
 * Pencil: design/sallary-first-iteration.pen, node `vtDMA` (`Категория товара · Выпадающее меню`,
 * desktop) — the `ProductSold`/`UsedProductSold` category field: a `Select`-styled trigger opening a
 * searchable category tree (data from `GET /v1/shop/warehouse/catalog`, `id`/`name`/`pathName`/
 * `children`), a pinned "Все категории" row (maps to `category: null`, "правило действует на все
 * товары", see `contracts/commands/shop-salary-rule.ts`), the selected row highlighted with a
 * checkmark, and a footer "Сбросить" back to "Все категории". The mockup's rows also show a product
 * count per category — omitted here: the catalog endpoint deliberately has no product-count field
 * (`backend/src/domains/shop/CLAUDE.md`: "без товаров/остатков"), so there is no real count to show.
 *
 * Page-local (not `shared/ui-kit`) — a category-tree combobox is specific to this one shop field,
 * not a general-purpose atom other pages need yet.
 *
 * Фаза 5 (mobile adaptive): this popover is the `md:` and up presentation only — `../CategoryField.tsx`
 * wraps it in `hidden md:block` and renders `CategoryBottomSheet.tsx` (node `xF4KU`) alongside it for
 * `md:hidden`. Both share `core/model/catalogTree.ts`'s tree helpers, the tree/search markup from
 * `CategorySearchInput.tsx`/`CategoryTreeBody.tsx` and the same `value`/`onValueChange` contract, so the two are pure
 * breakpoint-switched presentations of one selection, not a forked copy of the tree logic.
 */
export function CategoryCombobox({
    value,
    onValueChange,
    categories,
    isLoading,
    error,
    className,
}: CategoryComboboxProps) {
    // Открытие/поиск/развёрнутые узлы и подпись выбранной категории — общий с bottom sheet-ом стейт
    // (`../model/useCategoryOverlay.ts`): строка поиска сбрасывается и предки выбранной категории
    // разворачиваются прямо в `onOpenChange`, а не в `useEffect`.
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
    } = useCategoryOverlay({ value, categories })

    function pick(id: string | null) {
        onValueChange(id)
        setOpen(false)
    }

    return (
        <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
            <PopoverPrimitive.Trigger asChild>
                <button type="button" disabled={isLoading} className={cn(CATEGORY_TRIGGER_CLASS, className)}>
                    <span className="truncate">
                        {isLoading ? 'Загрузка...' : error ? 'Не удалось загрузить' : selectedLabel}
                    </span>
                    <ChevronDown
                        className={cn('size-[15px] shrink-0 text-ink-muted transition-transform', open && 'rotate-180')}
                    />
                </button>
            </PopoverPrimitive.Trigger>

            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    align="start"
                    sideOffset={6}
                    className="z-50 flex w-(--radix-popover-trigger-width) min-w-[280px] flex-col overflow-hidden rounded-[10px] border border-hairline bg-surface shadow-lg"
                >
                    <CategorySearchInput
                        autoFocus
                        query={query}
                        onQueryChange={setQuery}
                        classes={POPOVER_SEARCH_CLASSES}
                    />

                    <div className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto p-1.5">
                        <CategoryTreeBody
                            categories={categories}
                            query={query}
                            searchResults={searchResults}
                            selectedId={value}
                            expandedIds={expandedIds}
                            onToggleExpanded={toggleExpanded}
                            onSelect={pick}
                            mark={SELECTED_MARK}
                            classes={POPOVER_TREE_CLASSES}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-hairline p-2.5">
                        <p className="font-ui text-[11px] leading-[1.3] text-ink-faint">
                            Выбор родительской категории включает все вложенные
                        </p>
                        <button
                            type="button"
                            onClick={() => pick(null)}
                            className="shrink-0 font-ui text-xs font-semibold text-ok-ink hover:underline"
                        >
                            Сбросить
                        </button>
                    </div>
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    )
}
