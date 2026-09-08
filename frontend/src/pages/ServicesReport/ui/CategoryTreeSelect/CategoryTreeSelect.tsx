import { useMemo } from 'react'
import { Layers } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'

import { Chip } from '@/shared/ui-kit/atoms/Chip'
import { buildTree } from '@/shared/lib/tree.ts'
import type { ServiceCategory } from '@/pages/ServicesReport/model/types.ts'

import { useCategoryOverlay } from './model/useCategoryOverlay.ts'
import { CategorySearchInput } from './ui/CategorySearchInput.tsx'
import { CategoryTreeBody } from './ui/CategoryTreeBody.tsx'
import { SEARCH_CLASSES, TREE_CLASSES } from './ui/categoryOverlay.ts'

export type CategoryTreeSelectProps = {
    categories: ServiceCategory[]
    selectedId: string | null
    onChange: (id: string | null) => void
}

const SELECTED_MARK = <div className="size-[7px] shrink-0 rounded-full bg-brand-strong" />

/**
 * Поле выбора категории на фильтр-баре `/services` — поповер с поиском по дереву категорий,
 * закреплённой строкой «Все категории» и футером со сбросом. UX перенесён из понравившейся
 * пользователю реализации `features/SalaryRuleForm/ui/CategoryField` (поле «Категория товара»
 * зарплатного правила магазина): та же структура поповера (поиск сверху, скроллируемое дерево,
 * футер-подсказка + «Сбросить»), тот же контракт `value`/`onValueChange`. Триггер здесь остаётся
 * прежним `Chip` (с крестиком сброса выбранной категории) — так он уже вписан в остальной ряд
 * фильтров `ServicesFilterBar`, а не кнопка `Select`-стиля, как в зарплатном правиле.
 *
 * Источник данных другой формы, чем у зарплатного правила: `GET
 * /v1/service/reports/service-categories` отдаёт плоский список `{ id: number; parentId }`, а не
 * готовое вложенное дерево — поэтому дерево строится на клиенте через `buildTree`
 * (`@/shared/lib/tree.ts`), а не переиспользует `catalogTree.ts` того модуля напрямую.
 */
export function CategoryTreeSelect({ categories, selectedId, onChange }: CategoryTreeSelectProps) {
    const tree = useMemo(
        () => buildTree(categories, (a, b) => a.name.localeCompare(b.name, 'ru')),
        [categories],
    )

    const { open, setOpen, query, setQuery, expandedIds, selectedLabel, searchResults, toggleExpanded, handleOpenChange } =
        useCategoryOverlay({ selectedId, categories })

    function pick(id: string | null) {
        onChange(id)
        setOpen(false)
    }

    return (
        <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
            <PopoverPrimitive.Trigger asChild>
                {selectedId ? (
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
