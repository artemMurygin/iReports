import { useMemo } from 'react'
import type { BreadcrumbItem, ServiceCategory, ServicesFilters } from '@/pages/ServicesReport/model/types.ts'

// Чистая функция на уровне модуля (а не внутри хука): объявление внутри useBreadcrumbs
// пересоздавало её на каждый рендер и не давало React Compiler сохранить
// useMemo-мемоизацию (react-hooks: «Existing memoization could not be preserved»).
function buildBreadcrumbs(categories: ServiceCategory[], selectedId: string | null): BreadcrumbItem[] {
    const crumbs: BreadcrumbItem[] = [{ id: null, name: 'Все' }]
    if (selectedId === null) return crumbs

    const path: ServiceCategory[] = []
    let current: ServiceCategory | undefined = categories.find((c) => c.id === Number(selectedId))
    while (current) {
        path.unshift(current)
        const parentId = current.parentId
        current = parentId !== null ? categories.find((c) => c.id === parentId) : undefined
    }
    for (const cat of path) {
        crumbs.push({ id: String(cat.id), name: cat.name })
    }
    return crumbs
}

export function useBreadcrumbs(categories: ServiceCategory[], filters: ServicesFilters) {
    const breadcrumbs = useMemo(
        () => buildBreadcrumbs(categories, filters.selectedCategoryId),
        [categories, filters.selectedCategoryId],
    )

    return {
        breadcrumbs,
    }
}
