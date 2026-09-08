import { useState } from 'react'
import type { ServiceAnalyticsEntry } from '@/kernel/types'
import type { ServiceVariantFilter } from '@/kernel/serviceVariant.ts'

const INITIAL_COUNT = 6
const STEP = 6

/** "Показать ещё" для мобильного списка карточек — раскрывает +6 строк за клик, сбрасывается на
 * начальные 6 при смене поиска/вкладки "Вариант"/массива `services` — та же логика сброса
 * "при рендере", что и `useServicesTablePage` (см. её комментарий про `set-state-in-effect`),
 * только `visibleCount` растёт кумулятивно, а не листает страницы. */
export function useLoadMoreRows(
    filteredRows: ServiceAnalyticsEntry[],
    search: string,
    variantFilter: ServiceVariantFilter,
    services: ServiceAnalyticsEntry[],
) {
    const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT)
    const [resetKey, setResetKey] = useState<[string, ServiceVariantFilter, ServiceAnalyticsEntry[]]>([
        search,
        variantFilter,
        services,
    ])

    if (resetKey[0] !== search || resetKey[1] !== variantFilter || resetKey[2] !== services) {
        setResetKey([search, variantFilter, services])
        setVisibleCount(INITIAL_COUNT)
    }

    const visibleRows = filteredRows.slice(0, visibleCount)

    return {
        visibleRows,
        canShowMore: visibleCount < filteredRows.length,
        showMore: () => setVisibleCount((count) => count + STEP),
        shown: visibleRows.length,
        total: filteredRows.length,
    }
}
