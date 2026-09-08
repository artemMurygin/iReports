import { useState } from 'react'
import { loadDataFromStorage, saveDataToStorage } from '@/shared/lib/storage.ts'
import { OPTIONAL_COLUMN_IDS, type ColumnVisibility, type OptionalColumnId } from './columns.ts'

const STORAGE_KEY = 'columns:services-table'

const DEFAULT_VISIBILITY: ColumnVisibility = OPTIONAL_COLUMN_IDS.reduce((acc, id) => {
    acc[id] = true
    return acc
}, {} as ColumnVisibility)

function normalize(stored: Partial<ColumnVisibility> | null): ColumnVisibility {
    if (!stored) return DEFAULT_VISIBILITY
    const result = { ...DEFAULT_VISIBILITY }
    for (const id of OPTIONAL_COLUMN_IDS) {
        const value = stored[id]
        if (typeof value === 'boolean') result[id] = value
    }
    return result
}

/** Персистит набор видимых опциональных колонок в localStorage (ключ `columns:services-table`,
 * тот же помощник `shared/lib/storage.ts`, что и `pages/ServicesReport/model/useFilters.tsx`). */
export function useColumnVisibility() {
    const [visibility, setVisibility] = useState<ColumnVisibility>(() =>
        normalize(loadDataFromStorage<Partial<ColumnVisibility>>(STORAGE_KEY)),
    )

    function toggleColumn(id: OptionalColumnId, checked: boolean) {
        setVisibility((prev) => {
            const next = { ...prev, [id]: checked }
            saveDataToStorage(STORAGE_KEY, next)
            return next
        })
    }

    return { visibility, toggleColumn }
}
