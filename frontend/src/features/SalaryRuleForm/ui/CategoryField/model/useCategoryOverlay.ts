import { useMemo, useState } from 'react'
import type { CatalogCategoryResponse } from 'ireports-contracts'

import { findAncestorIds, findCategoryNode, searchCategories } from '../../../model/catalogTree.ts'
import { ALL_CATEGORIES_LABEL } from '../ui/categoryOverlay.ts'

export type UseCategoryOverlayParams = {
    value: string | null
    categories: CatalogCategoryResponse[]
    /** Вызывается на переходе «закрыт → открыт», до разворачивания предков выбранной категории —
     * bottom sheet пере-засевает им свой `staged` (см. `ui/CategoryBottomSheet.tsx`), popover не
     * передаёт его вовсе. */
    onOpen?: () => void
}

/**
 * Состояние, общее для обоих оверлеев поля «Категория товара» (`ui/CategoryCombobox.tsx` — popover
 * на `md:` и выше, `ui/CategoryBottomSheet.tsx` — bottom sheet ниже `md:`): открыт/закрыт, строка
 * поиска, набор развёрнутых узлов дерева, подпись выбранной категории и результаты поиска.
 *
 * Строка поиска сбрасывается, а цепочка предков текущего выбора разворачивается прямо в
 * `handleOpenChange`, а не в `useEffect` — это часть самого действия открытия, а не синхронизация
 * стейта по факту.
 */
export function useCategoryOverlay({ value, categories, onOpen }: UseCategoryOverlayParams) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    function handleOpenChange(next: boolean) {
        setOpen(next)
        if (!next) return
        setQuery('')
        onOpen?.()
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

    return {
        open,
        setOpen,
        query,
        setQuery,
        expandedIds,
        selectedLabel,
        searchResults,
        toggleExpanded,
        handleOpenChange,
    }
}
