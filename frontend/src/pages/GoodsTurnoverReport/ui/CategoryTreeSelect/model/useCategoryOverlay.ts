import { useMemo, useState } from 'react'
import type { ProductCategoryResponse } from 'ireports-contracts'

import { getAncestorIds } from '@/shared/lib/tree.ts'
import { searchCategories, type CategorySearchMatch } from '@/pages/GoodsTurnoverReport/model/categoryTree.ts'

import { ALL_CATEGORIES_LABEL } from '../ui/categoryOverlay.ts'

export type UseCategoryOverlayParams = {
    selectedId: number | null
    categories: ProductCategoryResponse[]
}

/** Состояние поповера выбора товарной категории: открыт/закрыт, строка поиска, набор развёрнутых
 * узлов дерева, подпись выбранной категории и результаты поиска. Портировано из
 * `pages/ServicesReport/ui/CategoryTreeSelect/model/useCategoryOverlay.ts` (openspec/changes/
 * service-turnover-report, задача 17) под `ProductCategoryResponse`/`selectedId: number | null` —
 * без `Number()`-конвертации, которая была нужна там из-за строкового `ServiceCategory`-контракта.
 * Строка поиска сбрасывается, а цепочка предков текущего выбора разворачивается прямо в
 * `handleOpenChange`, а не в `useEffect` — это часть самого действия открытия, а не синхронизация
 * стейта по факту. */
export function useCategoryOverlay({ selectedId, categories }: UseCategoryOverlayParams) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

    function handleOpenChange(next: boolean) {
        setOpen(next)
        if (!next) return
        setQuery('')
        if (selectedId === null) return
        const ancestors = getAncestorIds(categories, selectedId)
        if (ancestors.size > 0) setExpandedIds((prev) => new Set([...prev, ...ancestors]))
    }

    const selectedLabel = useMemo(() => {
        if (selectedId === null) return ALL_CATEGORIES_LABEL
        return categories.find((c) => c.id === selectedId)?.name ?? String(selectedId)
    }, [selectedId, categories])

    const searchResults: CategorySearchMatch[] = useMemo(
        () => searchCategories(categories, query),
        [categories, query],
    )

    function toggleExpanded(id: number) {
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
