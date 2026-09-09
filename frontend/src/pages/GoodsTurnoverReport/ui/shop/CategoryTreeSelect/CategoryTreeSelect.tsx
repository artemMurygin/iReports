import { useMemo } from 'react'
import { Layers } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'

import { Chip } from '@/shared/ui-kit/atoms/Chip'
import { buildTree } from '@/shared/lib/tree.ts'
import type { ShopCategoryRef } from '@/pages/GoodsTurnoverReport/model/shop/categoryTree.ts'

import { SEARCH_CLASSES, TREE_CLASSES } from '../../CategoryTreeSelect/ui/categoryOverlay.ts'
import { CategorySearchInput } from '../../CategoryTreeSelect/ui/CategorySearchInput.tsx'
import { useShopCategoryOverlay } from './model/useCategoryOverlay.ts'
import { ShopCategoryTreeBody } from './ui/CategoryTreeBody.tsx'

export type ShopCategoryTreeSelectProps = {
    categories: ShopCategoryRef[]
    selectedId: string | null
    onChange: (id: string | null) => void
}

const SELECTED_MARK = <div className="size-[7px] shrink-0 rounded-full bg-brand-strong" />

/**
 * Портировано из `../../CategoryTreeSelect/CategoryTreeSelect.tsx` (направление `service`) под
 * каталог категорий магазина (`ShopCategoryRef`, строковый `id`) — тот же визуальный паттерн и UX
 * (поиск сверху, скроллируемое дерево, футер-подсказка + «Сбросить», триггер — `Chip` с крестиком
 * сброса, см. комментарий оригинала), только `selectedId`/`onChange` типизированы как
 * `string | null` вместо `number | null`. `CategorySearchInput`/`categoryOverlay.ts` (стили/
 * подписи) переиспользуются как есть — они не завязаны на тип id категории.
 */
export function ShopCategoryTreeSelect({ categories, selectedId, onChange }: ShopCategoryTreeSelectProps) {
    const tree = useMemo(
        () => buildTree<ShopCategoryRef, string>(categories, (a, b) => a.name.localeCompare(b.name, 'ru')),
        [categories],
    )

    const { open, setOpen, query, setQuery, expandedIds, selectedLabel, searchResults, toggleExpanded, handleOpenChange } =
        useShopCategoryOverlay({ selectedId, categories })

    function pick(id: string | null) {
        onChange(id)
        setOpen(false)
    }

    return (
        <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
            <PopoverPrimitive.Trigger asChild>
                {selectedId !== null ? (
                    <Chip
                        icon={<Layers />}
                        className="border-brand-border bg-brand-soft text-ok-ink"
                        onRemove={() => onChange(null)}
                    >
                        {selectedLabel}
                    </Chip>
                ) : (
                    <Chip icon={<Layers />}>{selectedLabel}</Chip>
                )}
            </PopoverPrimitive.Trigger>

            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    align="start"
                    sideOffset={6}
                    className="z-50 flex w-[300px] min-w-[280px] flex-col overflow-hidden rounded-[10px] border border-hairline bg-surface shadow-lg"
                >
                    <CategorySearchInput autoFocus query={query} onQueryChange={setQuery} classes={SEARCH_CLASSES} />

                    <div className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto p-1.5">
                        <ShopCategoryTreeBody
                            tree={tree}
                            query={query}
                            searchResults={searchResults}
                            selectedId={selectedId}
                            expandedIds={expandedIds}
                            onToggleExpanded={toggleExpanded}
                            onSelect={pick}
                            mark={SELECTED_MARK}
                            classes={TREE_CLASSES}
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
