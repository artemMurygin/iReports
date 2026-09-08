import { useState } from 'react'
import type { ServiceAnalyticsEntry } from '@/kernel/types'
import type { ServiceVariantFilter } from '@/kernel/serviceVariant.ts'

export const PAGE_SIZE = 14

/** Реальная клиентская пагинация десктоп-таблицы, страница по 14 строк (макет: "Показано 14 из
 * 102"). Страница сбрасывается на 1 при смене поиска/вкладки "Вариант" или самого массива
 * `services` (identity) — сравнением с предыдущими значениями прямо при рендере (React's
 * "adjusting state when a prop changes" паттерн: https://react.dev/learn/you-might-not-need-an-effect),
 * а не в `useEffect` — синхронный `setState` в эффекте создаёт лишний каскад рендеров и запрещён
 * линт-правилом `react-hooks/set-state-in-effect`. */
export function useServicesTablePage(
    filteredRows: ServiceAnalyticsEntry[],
    search: string,
    variantFilter: ServiceVariantFilter,
    services: ServiceAnalyticsEntry[],
) {
    const [page, setPage] = useState(1)
    const [resetKey, setResetKey] = useState<[string, ServiceVariantFilter, ServiceAnalyticsEntry[]]>([
        search,
        variantFilter,
        services,
    ])

    if (resetKey[0] !== search || resetKey[1] !== variantFilter || resetKey[2] !== services) {
        setResetKey([search, variantFilter, services])
        setPage(1)
    }

    const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
    const safePage = Math.min(page, pageCount)
    const start = (safePage - 1) * PAGE_SIZE
    const pageRows = filteredRows.slice(start, start + PAGE_SIZE)

    return {
        page: safePage,
        setPage,
        pageCount,
        pageRows,
        startIndex: start,
        shown: pageRows.length,
        total: filteredRows.length,
    }
}
