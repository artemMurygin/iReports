import { useCallback, useState } from 'react'

/** Портировано из `../../GoodsTurnoverTable/model/useExpandedCategories.ts` (направление
 * `service`) под строковый `categoryId` каталога магазина — см. комментарий оригинала за полным
 * обоснованием (хранится набор РАЗВЁРНУТЫХ id, дефолт «всё свёрнуто»). */
export function useExpandedShopCategories() {
    const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set())

    const toggle = useCallback((categoryId: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(categoryId)) next.delete(categoryId)
            else next.add(categoryId)
            return next
        })
    }, [])

    const isExpanded = useCallback((categoryId: string) => expandedIds.has(categoryId), [expandedIds])

    return { isExpanded, toggle }
}
