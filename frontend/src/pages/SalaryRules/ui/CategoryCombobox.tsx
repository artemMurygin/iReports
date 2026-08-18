import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Folder, Layers, Search, X } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import type { CatalogCategoryResponse } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import { findAncestorIds, findCategoryNode, searchCategories } from '../model/catalogTree.ts'

export type CategoryComboboxProps = {
    value: string | null
    onValueChange: (value: string | null) => void
    categories: CatalogCategoryResponse[]
    isLoading?: boolean
    error?: string | null
    className?: string
}

const ALL_CATEGORIES_LABEL = 'Все категории'

/** Shared with `CategoryBottomSheet.tsx`'s trigger (Фаза 5) so the closed-state button looks
 * identical regardless of which overlay the current breakpoint opens. */
export const CATEGORY_TRIGGER_CLASS =
    'flex h-9 w-full items-center justify-between gap-2 rounded-[8px] border border-hairline bg-surface px-3 font-ui text-[13px] font-medium text-ink outline-none transition-colors focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-faint'

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
 * Фаза 5 (mobile adaptive): this popover is the `md:` and up presentation only — callers wrap it
 * in `hidden md:block` and render `CategoryBottomSheet.tsx` (node `xF4KU`) alongside it for
 * `md:hidden`. Both share `catalogTree.ts`'s tree helpers and the same `value`/`onValueChange`
 * contract, so the two are pure breakpoint-switched presentations of one selection, not a forked
 * copy of the tree logic.
 */
export function CategoryCombobox({ value, onValueChange, categories, isLoading, error, className }: CategoryComboboxProps) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    // Reset the search box and auto-expand the ancestor chain of the current selection whenever the
    // popover opens — done in the `onOpenChange` handler (below), not a `useEffect`, so it runs once
    // as part of the open action itself rather than as a synchronized-state side effect.
    function handleOpenChange(next: boolean) {
        setOpen(next)
        if (!next) return
        setQuery('')
        if (value === null) return
        const ancestors = findAncestorIds(categories, value)
        if (ancestors && ancestors.length > 0) setExpandedIds((prev) => new Set([...prev, ...ancestors]))
    }

    const selectedLabel = useMemo(() => {
        if (value === null) return ALL_CATEGORIES_LABEL
        return findCategoryNode(categories, value)?.name ?? value
    }, [value, categories])

    const searchResults = useMemo(() => searchCategories(categories, query), [categories, query])

    function toggleExpanded(id: string) {
        setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function pick(id: string | null) {
        onValueChange(id)
        setOpen(false)
    }

    function renderNode(node: CatalogCategoryResponse, depth: number) {
        const hasChildren = node.children.length > 0
        const isExpanded = expandedIds.has(node.id)
        const isSelected = value === node.id

        return (
            <Fragment key={node.id}>
                <div
                    className={cn(
                        'flex w-full items-center gap-1.5 rounded-[8px] py-[7px] pr-2.5 text-left transition-colors',
                        isSelected ? 'bg-brand-soft' : 'hover:bg-canvas',
                    )}
                    style={{ paddingLeft: 10 + depth * 16 }}
                >
                    {hasChildren ? (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation()
                                toggleExpanded(node.id)
                            }}
                            aria-label={isExpanded ? 'Свернуть категорию' : 'Развернуть категорию'}
                            className="flex size-4 shrink-0 items-center justify-center text-ink-muted hover:text-ink"
                        >
                            <ChevronRight className={cn('size-3.5 transition-transform', isExpanded && 'rotate-90')} />
                        </button>
                    ) : (
                        <span className="size-4 shrink-0" />
                    )}
                    <button type="button" onClick={() => pick(node.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                        <Folder className="size-[13px] shrink-0 text-ink-faint" />
                        <span className={cn('truncate font-ui text-[13px]', isSelected ? 'font-semibold text-ink' : 'font-medium text-ink')}>
                            {node.name}
                        </span>
                    </button>
                    {isSelected && <div className="size-[7px] shrink-0 rounded-full bg-brand-strong" />}
                </div>
                {hasChildren && isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
            </Fragment>
        )
    }

    return (
        <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
            <PopoverPrimitive.Trigger asChild>
                <button type="button" disabled={isLoading} className={cn(CATEGORY_TRIGGER_CLASS, className)}>
                    <span className="truncate">
                        {isLoading ? 'Загрузка...' : error ? 'Не удалось загрузить' : selectedLabel}
                    </span>
                    <ChevronDown className={cn('size-[15px] shrink-0 text-ink-muted transition-transform', open && 'rotate-180')} />
                </button>
            </PopoverPrimitive.Trigger>

            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    align="start"
                    sideOffset={6}
                    className="z-50 flex w-(--radix-popover-trigger-width) min-w-[280px] flex-col overflow-hidden rounded-[10px] border border-hairline bg-surface shadow-lg"
                >
                    <div className="flex items-center gap-2 border-b border-hairline p-2.5">
                        <Search className="size-[14px] shrink-0 text-ink-faint" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Поиск по категориям"
                            className="w-full bg-transparent font-ui text-[13px] text-ink outline-none placeholder:text-ink-faint"
                        />
                        {query !== '' && (
                            <button type="button" onClick={() => setQuery('')} aria-label="Очистить поиск" className="text-ink-faint hover:text-ink">
                                <X className="size-[13px]" />
                            </button>
                        )}
                    </div>

                    <div className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto p-1.5">
                        {query.trim() === '' ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => pick(null)}
                                    className={cn(
                                        'flex w-full items-center gap-1.5 rounded-[8px] py-[7px] pr-2.5 pl-2.5 text-left transition-colors',
                                        value === null ? 'bg-brand-soft' : 'hover:bg-canvas',
                                    )}
                                >
                                    <Layers className="size-[13px] shrink-0 text-ink-faint" />
                                    <span className={cn('flex-1 truncate font-ui text-[13px]', value === null ? 'font-semibold text-ink' : 'font-medium text-ink')}>
                                        {ALL_CATEGORIES_LABEL}
                                    </span>
                                    {value === null && <div className="size-[7px] shrink-0 rounded-full bg-brand-strong" />}
                                </button>
                                <div className="my-1 h-px w-full bg-hairline" />
                                {categories.length === 0 ? (
                                    <p className="px-2.5 py-2 font-ui text-xs text-ink-faint">Категории не найдены</p>
                                ) : (
                                    categories.map((node) => renderNode(node, 0))
                                )}
                            </>
                        ) : searchResults.length === 0 ? (
                            <p className="px-2.5 py-2 font-ui text-xs text-ink-faint">Ничего не найдено</p>
                        ) : (
                            searchResults.map(({ node, ancestors }) => (
                                <button
                                    key={node.id}
                                    type="button"
                                    onClick={() => pick(node.id)}
                                    className={cn(
                                        'flex w-full flex-col items-start gap-0.5 rounded-[8px] px-2.5 py-[7px] text-left transition-colors',
                                        value === node.id ? 'bg-brand-soft' : 'hover:bg-canvas',
                                    )}
                                >
                                    <span className="truncate font-ui text-[13px] font-medium text-ink">{node.name}</span>
                                    {ancestors.length > 0 && (
                                        <span className="truncate font-ui text-[11px] text-ink-faint">
                                            {ancestors.map((a) => a.name).join(' / ')}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
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
