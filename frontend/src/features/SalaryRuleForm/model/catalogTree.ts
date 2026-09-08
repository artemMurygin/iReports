import type { CatalogCategoryResponse } from 'ireports-contracts'

/**
 * Pure tree helpers over `GET /v1/shop/warehouse/catalog`'s response (`CatalogCategoryResponse[]` —
 * `id`/`name`/`pathName`/`children`, see `contracts/commands/catalog.ts`) for `core/ui/CategoryField`
 * (Фаза 4, node `vtDMA` — `Категория товара · Выпадающее меню`). No product-count field exists on
 * this response (the catalog module deliberately stops at categories, "без товаров/остатков" — see
 * `backend/src/domains/shop/CLAUDE.md`), so the combobox doesn't render one, unlike the mockup's
 * example counts.
 */

/** Depth-first search by id — used to resolve the combobox trigger's label from a stored `category`
 * id, and by `core/ui/RuleRow`/`ruleSummary.ts` to show a category name in the collapsed row. */
export function findCategoryNode(nodes: CatalogCategoryResponse[], id: string): CatalogCategoryResponse | undefined {
    for (const node of nodes) {
        if (node.id === id) return node
        const found = findCategoryNode(node.children, id)
        if (found) return found
    }
    return undefined
}

/** Ids of every ancestor of `id`, root-first — used to auto-expand the tree down to the currently
 * selected category when the combobox opens, so the selection is visible instead of buried under
 * collapsed parents. `null` when `id` isn't found (e.g. stale/unknown category). */
export function findAncestorIds(nodes: CatalogCategoryResponse[], id: string, path: string[] = []): string[] | null {
    for (const node of nodes) {
        if (node.id === id) return path
        const found = findAncestorIds(node.children, id, [...path, node.id])
        if (found) return found
    }
    return null
}

export type CategorySearchMatch = { node: CatalogCategoryResponse; ancestors: CatalogCategoryResponse[] }

/** Flat, depth-first list of every node whose `name` contains `query` (case-insensitive), each
 * paired with its ancestor chain (root-first) so the search result row can show a breadcrumb even
 * though the tree's own indentation/expand state is bypassed while searching. Empty query returns
 * an empty list — callers fall back to the full tree view instead of "no results". */
export function searchCategories(nodes: CatalogCategoryResponse[], query: string): CategorySearchMatch[] {
    const normalized = query.trim().toLowerCase()
    if (normalized === '') return []

    const matches: CategorySearchMatch[] = []

    function walk(list: CatalogCategoryResponse[], ancestors: CatalogCategoryResponse[]) {
        for (const node of list) {
            if (node.name.toLowerCase().includes(normalized)) matches.push({ node, ancestors })
            walk(node.children, [...ancestors, node])
        }
    }

    walk(nodes, [])
    return matches
}
