import type { CatalogCategoryResponse, CatalogResponse } from 'ireports-contracts'
import { getDirectChildren as getDirectChildrenById, getSubtreeIds } from '@/shared/lib/tree.ts'

// Адаптация `../categoryTree.ts` (направление `service`) под каталог категорий магазина (`GET
// /v1/shop/warehouse/catalog`) — тот же UX `CategoryTreeSelect`, но источник данных другой формы:
// `service` отдаёт плоский список `{ id: number, parentId: number | null }` (`shared/lib/tree.ts`
// уже ожидает такую форму), `shop` отдаёт готовое ВЛОЖЕННОЕ дерево `{ id: string, name, pathName,
// children }` без `parentId` вообще — `flattenCatalog` ниже разворачивает его в плоский список с
// восстановленным `parentId` (родитель — тот узел, из чьих `children` встретился элемент; `null`
// для узлов верхнего уровня), чтобы дальше переиспользовать те же алгоритмы `shared/lib/tree.ts`
// (`getDirectChildren`/`getSubtreeIds`, теперь generic по `Id`, см. правку файла) с `Id = string`.
export type ShopCategoryRef = { id: string; name: string; parentId: string | null }

export function flattenCatalog(tree: CatalogResponse): ShopCategoryRef[] {
    const result: ShopCategoryRef[] = []

    function visit(node: CatalogCategoryResponse, parentId: string | null) {
        result.push({ id: node.id, name: node.name, parentId })
        for (const child of node.children) visit(child, node.id)
    }

    for (const root of tree) visit(root, null)
    return result
}

export function getDirectChildren(categories: ShopCategoryRef[], parentId: string | null): ShopCategoryRef[] {
    return getDirectChildrenById(categories, parentId)
}

/** Категория `selectedId` и все её потомки произвольной глубины (сама категория тоже включена) —
 * для фильтрации строк отчёта по выбранной родительской категории. */
export function resolveDescendantIds(categories: ShopCategoryRef[], selectedId: string): string[] {
    return getSubtreeIds(categories, selectedId)
}

export type ShopCategorySearchMatch = { category: ShopCategoryRef; ancestors: ShopCategoryRef[] }

function getAncestorChain(categories: ShopCategoryRef[], parentId: string | null): ShopCategoryRef[] {
    const chain: ShopCategoryRef[] = []
    let current = parentId !== null ? categories.find((c) => c.id === parentId) : undefined
    while (current) {
        chain.unshift(current)
        current = current.parentId !== null ? categories.find((c) => c.id === current!.parentId) : undefined
    }
    return chain
}

/** Плоский список категорий, чьё название содержит `query` (без учёта регистра), каждая — с
 * цепочкой предков (от корня) для хлебной крошки в результатах поиска, тот же UX, что `../
 * categoryTree.ts`. Пустой запрос возвращает пустой список — вызывающий код в этом случае
 * показывает обычное дерево, а не «ничего не найдено». */
export function searchCategories(categories: ShopCategoryRef[], query: string): ShopCategorySearchMatch[] {
    const normalized = query.trim().toLowerCase()
    if (normalized === '') return []
    return categories
        .filter((c) => c.name.toLowerCase().includes(normalized))
        .map((c) => ({ category: c, ancestors: getAncestorChain(categories, c.parentId) }))
}
