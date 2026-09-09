import type { ProductCategoryResponse } from 'ireports-contracts'
import { getDirectChildren as getDirectChildrenById, getSubtreeIds } from '@/shared/lib/tree.ts'

// Адаптация `pages/ServicesReport/model/categoryTree.ts` под справочник товарных категорий
// (`GET /v1/service/warehouse/product-categories`, openspec/changes/service-turnover-report,
// задача 17). Отличие от оригинала: там `ServiceCategory.id`/`selectedId` были `string` (под
// строковые query-параметры фильтра услуг), здесь `useGoodsTurnoverReportPage.ts` (задача 15,
// уже реализован) хранит `categoryId: number | null` напрямую — `ProductCategoryResponse.id`
// тоже `number` (контракт `ireports-contracts`, без `depth`, в отличие от `ServiceCategory`) — по-
// этому все функции здесь работают с `number | null` напрямую, без `String()`/`Number()`
// конвертаций на границе с `shared/lib/tree.ts` (`getDirectChildren`/`getSubtreeIds`), которые
// такие id и так принимают. `buildChartSeries` из оригинала сюда не переносится — это специфика
// графика услуг, у товарных категорий аналога нет (см. `GoodsTurnoverTable`, задача 18, вне этого
// диапазона).

export function getDirectChildren(
    categories: ProductCategoryResponse[],
    parentId: number | null,
): ProductCategoryResponse[] {
    return getDirectChildrenById(categories, parentId)
}

/** Категория `selectedId` и все её потомки произвольной глубины (сама категория тоже включена —
 * см. `shared/lib/tree.ts` `getSubtreeIds`), для фильтрации строк отчёта по выбранной родительской
 * категории (`GoodsTurnoverTable`, задача 18: «выбор родительской категории включает все
 * вложенные»). */
export function resolveDescendantIds(categories: ProductCategoryResponse[], selectedId: number): number[] {
    return getSubtreeIds(categories, selectedId)
}

export type CategorySearchMatch = { category: ProductCategoryResponse; ancestors: ProductCategoryResponse[] }

function getAncestorChain(categories: ProductCategoryResponse[], parentId: number | null): ProductCategoryResponse[] {
    const chain: ProductCategoryResponse[] = []
    let current = parentId !== null ? categories.find((c) => c.id === parentId) : undefined
    while (current) {
        chain.unshift(current)
        current = current.parentId !== null ? categories.find((c) => c.id === current!.parentId) : undefined
    }
    return chain
}

/** Плоский список категорий, чьё название содержит `query` (без учёта регистра), каждая — с
 * цепочкой предков (от корня) для хлебной крошки в результатах поиска — тот же UX, что
 * `pages/ServicesReport/model/categoryTree.ts`. Пустой запрос возвращает пустой список —
 * вызывающий код в этом случае показывает обычное дерево, а не «ничего не найдено». */
export function searchCategories(categories: ProductCategoryResponse[], query: string): CategorySearchMatch[] {
    const normalized = query.trim().toLowerCase()
    if (normalized === '') return []
    return categories
        .filter((c) => c.name.toLowerCase().includes(normalized))
        .map((c) => ({ category: c, ancestors: getAncestorChain(categories, c.parentId) }))
}
