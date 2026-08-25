import { useMemo, useState } from 'react'
import type { ServiceAnalyticsEntry } from '@/kernel/types'
import { matchesServiceVariantFilter, type ServiceVariantFilter } from '@/kernel/serviceVariant.ts'

/** Клиентский поиск по названию (регистронезависимая подстрока) + вкладки "Вариант" (OEM/AASP/HQ),
 * общие для десктоп-таблицы и мобильного списка карточек — обе поверхности рендерят один и тот же
 * `filteredRows`, различается только разметка строк (см. `ServicesTable.tsx`). */
export function useServiceRowsFilter(rows: ServiceAnalyticsEntry[]) {
    const [search, setSearch] = useState('')
    const [variantFilter, setVariantFilter] = useState<ServiceVariantFilter>('Все')

    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase()
        return rows.filter((row) => {
            if (!matchesServiceVariantFilter(row.serviceName, variantFilter)) return false
            if (query && !row.serviceName.toLowerCase().includes(query)) return false
            return true
        })
    }, [rows, search, variantFilter])

    return { search, setSearch, variantFilter, setVariantFilter, filteredRows }
}
