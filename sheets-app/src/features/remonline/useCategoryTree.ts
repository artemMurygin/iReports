import { useCallback, useRef, useState } from 'react'
import { buildCategoryTree } from './categoryTree'
import type { CategoryTree } from './categoryTree'
import { gas } from '@/shared/gas'

export type CategoryTreeStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface UseCategoryTreeResult {
    tree: CategoryTree | null
    status: CategoryTreeStatus
    error: string | null
    /**
     * Resolves the shared category tree, fetching it only once: returns the cached tree
     * immediately once loaded, awaits the in-flight fetch if one is already running, or starts a
     * new fetch otherwise. Mirrors the reference sidebar's single `categoryTree`/`categoriesLoaded`
     * module state, reused by both the add-service panel and the bulk create-services flow
     * (frontend/GoogleSheetsInterface/index.html `ensureCategoriesLoaded`, lines ~874-879).
     */
    ensureLoaded: () => Promise<CategoryTree>
}

/**
 * Loads `gas.getServiceCategories()` once, caches the built tree, and shares in-flight loads
 * across concurrent callers.
 */
export function useCategoryTree(): UseCategoryTreeResult {
    const [tree, setTree] = useState<CategoryTree | null>(null)
    const [status, setStatus] = useState<CategoryTreeStatus>('idle')
    const [error, setError] = useState<string | null>(null)
    const inFlightRef = useRef<Promise<CategoryTree> | null>(null)

    const ensureLoaded = useCallback(async (): Promise<CategoryTree> => {
        if (tree) return tree
        if (inFlightRef.current) return inFlightRef.current

        setStatus('loading')
        setError(null)

        const promise = gas
            .getServiceCategories()
            .then((categories) => {
                const built = buildCategoryTree(categories)
                setTree(built)
                setStatus('ready')
                return built
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err)
                setError(message)
                setStatus('error')
                throw err
            })
            .finally(() => {
                inFlightRef.current = null
            })

        inFlightRef.current = promise
        return promise
    }, [tree])

    return { tree, status, error, ensureLoaded }
}
