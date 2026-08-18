import { Fragment, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Folder, Layers, Search, X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { CatalogCategoryResponse } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'

import { findAncestorIds, findCategoryNode, searchCategories } from '../model/catalogTree.ts'

import { CATEGORY_TRIGGER_CLASS } from './CategoryCombobox.tsx'

export type CategoryBottomSheetProps = {
    value: string | null
    onValueChange: (value: string | null) => void
    categories: CatalogCategoryResponse[]
    isLoading?: boolean
    error?: string | null
    className?: string
}

const ALL_CATEGORIES_LABEL = 'Все категории'

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
 * Same tree helpers (`catalogTree.ts`) and the same documented product-count gap as
 * `CategoryCombobox.tsx` (no count field on the catalog endpoint) — see that file's comment.
 */
export function CategoryBottomSheet({ value, onValueChange, categories, isLoading, error, className }: CategoryBottomSheetProps) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
    const [staged, setStaged] = useState<string | null>(value)

    function handleOpenChange(next: boolean) {
        setOpen(next)
        if (!next) return
        setQuery('')
        setStaged(value)
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

    function applyStaged() {
        onValueChange(staged)
        setOpen(false)
    }

    function renderNode(node: CatalogCategoryResponse, depth: number) {
        const hasChildren = node.children.length > 0
        const isExpanded = expandedIds.has(node.id)
        const isSelected = staged === node.id

        return (
            <Fragment key={node.id}>
                <div
                    className={cn(
                        'flex w-full items-center gap-1.5 rounded-[8px] py-[9px] pr-2.5 text-left transition-colors',
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
                            className="flex size-5 shrink-0 items-center justify-center text-ink-muted hover:text-ink"
                        >
                            <ChevronRight className={cn('size-4 transition-transform', isExpanded && 'rotate-90')} />
                        </button>
                    ) : (
                        <span className="size-5 shrink-0" />
                    )}
                    <button
                        type="button"
                        onClick={() => setStaged(node.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                        <Folder className="size-[14px] shrink-0 text-ink-faint" />
                        <span className={cn('truncate font-ui text-[14px]', isSelected ? 'font-semibold text-ink' : 'font-medium text-ink')}>
                            {node.name}
                        </span>
                    </button>
                    {isSelected && <Check className="size-4 shrink-0 text-brand-strong" />}
                </div>
                {hasChildren && isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
            </Fragment>
        )
    }

    return (
        <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
            <DialogPrimitive.Trigger asChild>
                <button type="button" disabled={isLoading} className={cn(CATEGORY_TRIGGER_CLASS, className)}>
                    <span className="truncate">{isLoading ? 'Загрузка...' : error ? 'Не удалось загрузить' : selectedLabel}</span>
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

                    <div className="flex items-center gap-2 border-b border-hairline p-3">
                        <Search className="size-[15px] shrink-0 text-ink-faint" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Поиск по категориям"
                            className="w-full bg-transparent font-ui text-[14px] text-ink outline-none placeholder:text-ink-faint"
                        />
                        {query !== '' && (
                            <button type="button" onClick={() => setQuery('')} aria-label="Очистить поиск" className="text-ink-faint hover:text-ink">
                                <X className="size-[14px]" />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
                        {query.trim() === '' ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setStaged(null)}
                                    className={cn(
                                        'flex w-full items-center gap-1.5 rounded-[8px] py-[9px] pr-2.5 pl-2.5 text-left transition-colors',
                                        staged === null ? 'bg-brand-soft' : 'hover:bg-canvas',
                                    )}
                                >
                                    <Layers className="size-[14px] shrink-0 text-ink-faint" />
                                    <span className={cn('flex-1 truncate font-ui text-[14px]', staged === null ? 'font-semibold text-ink' : 'font-medium text-ink')}>
                                        {ALL_CATEGORIES_LABEL}
                                    </span>
                                    {staged === null && <Check className="size-4 shrink-0 text-brand-strong" />}
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
                                    onClick={() => setStaged(node.id)}
                                    className={cn(
                                        'flex w-full flex-col items-start gap-0.5 rounded-[8px] px-2.5 py-[9px] text-left transition-colors',
                                        staged === node.id ? 'bg-brand-soft' : 'hover:bg-canvas',
                                    )}
                                >
                                    <span className="truncate font-ui text-[14px] font-medium text-ink">{node.name}</span>
                                    {ancestors.length > 0 && (
                                        <span className="truncate font-ui text-[11px] text-ink-faint">
                                            {ancestors.map((a) => a.name).join(' / ')}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-hairline p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        <button type="button" onClick={() => setStaged(null)} className="shrink-0 font-ui text-sm font-semibold text-ok-ink">
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
