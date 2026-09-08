import type { ServiceCategory } from '@/shared/gas/types'

/**
 * Flat service-category list, re-indexed for the cascading selects and for validation lookups.
 * Mirrors the reference sidebar's `buildCategoryTree` (frontend/GoogleSheetsInterface/index.html
 * lines ~858-872).
 */
export interface CategoryTree {
    /** Children grouped by parentId — `null` is the key for root categories. */
    byParent: Map<number | null, ServiceCategory[]>
    byId: Map<number, ServiceCategory>
    /** Trimmed category name -> id, used to resolve a category path's last segment. */
    byName: Map<string, number>
}

export function buildCategoryTree(categories: ServiceCategory[]): CategoryTree {
    const byParent = new Map<number | null, ServiceCategory[]>()
    const byId = new Map<number, ServiceCategory>()
    const byName = new Map<string, number>()

    categories.forEach((category) => {
        byId.set(category.id, category)
        byName.set(category.name.trim(), category.id)
        const parentKey = category.parentId ?? null
        if (!byParent.has(parentKey)) byParent.set(parentKey, [])
        byParent.get(parentKey)?.push(category)
    })

    return { byParent, byId, byName }
}

/**
 * Walks `selectedIds` in level order and joins the matching categories' (trimmed) names with
 * ' > ', stopping at the first level that has no selection yet (mirrors the reference's
 * `getSelectedCategoryPath`, index.html lines ~921-933).
 */
export function getSelectedCategoryPath(selectedIds: (number | null)[], tree: CategoryTree): string {
    const names: string[] = []

    for (const id of selectedIds) {
        if (id === null) break
        const category = tree.byId.get(id)
        if (category) names.push(category.name.replace(/\s+$/, ''))
    }

    return names.join(' > ')
}
