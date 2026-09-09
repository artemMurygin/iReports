import { useMemo, useState } from 'react'

import { getAncestorIds } from '@/shared/lib/tree.ts'
import { searchCategories, type ShopCategoryRef, type ShopCategorySearchMatch } from '@/pages/GoodsTurnoverReport/model/shop/categoryTree.ts'

import { ALL_CATEGORIES_LABEL } from '../../../CategoryTreeSelect/ui/categoryOverlay.ts'

export type UseShopCategoryOverlayParams = {
    selectedId: string | null
    categories: ShopCategoryRef[]
}

/** Портировано из `../../CategoryTreeSelect/model/useCategoryOverlay.ts` (направление `service`)
 * под строковый `categoryId` каталога магазина — см. комментарий оригинала за полным описанием
 * поведения (сброс поиска и разворачивание цепочки предков текущего выбора при открытии). */
export function useShopCategoryOverlay({ selectedId, categories }: UseShopCategoryOverlayParams) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

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
        return categories.find((c) => c.id === selectedId)?.name ?? selectedId
    }, [selectedId, categories])

    const searchResults: ShopCategorySearchMatch[] = useMemo(
        () => searchCategories(categories, query),
        [categories, query],
    )

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
