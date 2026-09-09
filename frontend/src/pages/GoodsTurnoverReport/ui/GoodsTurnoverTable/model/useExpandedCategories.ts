import { useCallback, useState } from 'react'

/**
 * Локальное (не персистентное) состояние сворачивания строк `GoodsTurnoverTable` — набор
 * `categoryId`, которые пользователь явно РАЗВЕРНУЛ кликом (не наоборот: по умолчанию, до первого
 * клика, любая категория с потомками свёрнута — по запросу пользователя). `filterVisibleRows`
 * (`model/goodsTurnoverTree.ts`) получает `isCollapsed = (id) => !isExpanded(id)`.
 *
 * Хранить именно РАЗВЁРНУТЫЕ id, а не свёрнутые, — намеренно: дефолт "всё свёрнуто" не зависит от
 * текущего набора строк (смена склада/периода/фильтра не требует отдельной синхронизации набора
 * "все id с детьми" с новым деревом через useEffect — react-hooks/set-state-in-effect, то же
 * правило, что уже определяет паттерн `warehouseId` в `useGoodsTurnoverReportPage.ts`).
 */
export function useExpandedCategories() {
    const [expandedIds, setExpandedIds] = useState<ReadonlySet<number>>(() => new Set())

    const toggle = useCallback((categoryId: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(categoryId)) next.delete(categoryId)
            else next.add(categoryId)
            return next
        })
    }, [])

    const isExpanded = useCallback((categoryId: number) => expandedIds.has(categoryId), [expandedIds])

    return { isExpanded, toggle }
}
