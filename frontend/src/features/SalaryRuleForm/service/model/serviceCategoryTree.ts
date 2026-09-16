import type { CatalogCategoryResponse, ListServiceCategoriesResponse } from 'ireports-contracts'

import { buildTree, type TreeNode } from '@/shared/lib/tree.ts'

/**
 * `GET /v1/service/reports/service-categories` возвращает плоский список (`id`/`name`/`parentId`/
 * `depth`, см. `contracts/commands/report.ts`), а `CategoryField` (общий для service/shop) ожидает
 * готовое дерево в форме `CatalogCategoryResponse` (`id`/`name`/`pathName`/`children`) — то же, что
 * `shop/model/useCatalog.ts` получает от `GET /v1/shop/warehouse/catalog` напрямую. Сшивка дерева
 * из плоского списка живёт здесь, а не в `api.ts`, чтобы `queryFn` возвращал сырой ответ backend.
 */
function toCategoryNode(node: TreeNode<ListServiceCategoriesResponse[number], number>, ancestorPath: string): CatalogCategoryResponse {
    const fullPath = ancestorPath ? `${ancestorPath}/${node.item.name}` : node.item.name
    return {
        id: String(node.item.id),
        name: node.item.name,
        pathName: ancestorPath,
        children: node.children.map((child) => toCategoryNode(child, fullPath)),
    }
}

export function buildServiceCategoryTree(categories: ListServiceCategoriesResponse): CatalogCategoryResponse[] {
    return buildTree(categories).map((root) => toCategoryNode(root, ''))
}
