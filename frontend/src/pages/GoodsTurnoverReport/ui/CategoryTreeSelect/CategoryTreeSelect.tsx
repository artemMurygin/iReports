import { useMemo } from 'react'
import { Layers } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import type { ProductCategoryResponse } from 'ireports-contracts'

import { Chip } from '@/shared/ui-kit/atoms/Chip'
import { buildTree } from '@/shared/lib/tree.ts'

import { useCategoryOverlay } from './model/useCategoryOverlay.ts'
import { CategorySearchInput } from './ui/CategorySearchInput.tsx'
import { CategoryTreeBody } from './ui/CategoryTreeBody.tsx'
import { SEARCH_CLASSES, TREE_CLASSES } from './ui/categoryOverlay.ts'

export type CategoryTreeSelectProps = {
    categories: ProductCategoryResponse[]
    selectedId: number | null
    onChange: (id: number | null) => void
}

const SELECTED_MARK = <div className="size-[7px] shrink-0 rounded-full bg-brand-strong" />

/**
 * Поле выбора товарной категории на фильтр-баре `/goods-turnover-report` — поповер с поиском по
 * дереву категорий, закреплённой строкой «Все категории» и футером со сбросом. Портировано из
 * `pages/ServicesReport/ui/CategoryTreeSelect/CategoryTreeSelect.tsx` (openspec/changes/
 * service-turnover-report, задача 17): тот же визуальный паттерн и UX (поиск сверху, скроллируемое
 * дерево, футер-подсказка + «Сбросить», триггер — `Chip` с крестиком сброса), портирован под
 * справочник товарных категорий (`GET /v1/service/warehouse/product-categories`,
 * `ProductCategoryResponse`) вместо сервисных.
 *
 * Отличие от оригинала: `selectedId`/`onChange` здесь типизированы как `number | null`, а не
 * `string | null` — `useGoodsTurnoverReportPage.ts` (задача 15, уже реализован) хранит
 * `categoryId: number | null` напрямую (тот же числовой тип, что и `ProductCategoryResponse.id` в
 * контракте), поэтому конвертация через `String()`/`Number()` на границе с этим полем не нужна —
 * `pages/ServicesReport` хранит id строкой ради строковых query-параметров фильтра услуг, у этой
 * страницы такого требования нет.
 *
 * Источник данных — тот же плоский список `{ id, name, parentId }` (без готового вложенного дерева),
 * что и у `ServiceCategory` — дерево строится на клиенте через `buildTree` (`@/shared/lib/tree.ts`).
 */
export function CategoryTreeSelect({ categories, selectedId, onChange }: CategoryTreeSelectProps) {
    const tree = useMemo(
        () => buildTree(categories, (a, b) => a.name.localeCompare(b.name, 'ru')),
        [categories],
    )

    const { open, setOpen, query, setQuery, expandedIds, selectedLabel, searchResults, toggleExpanded, handleOpenChange } =
        useCategoryOverlay({ selectedId, categories })

    function pick(id: number | null) {
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
                        <CategoryTreeBody
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
