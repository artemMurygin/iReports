import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { serviceFunnelQuery } from '@/pages/FunnelReport/queries.ts'
import type { DashboardFilters, DashboardKPI } from '@/pages/FunnelReport/types.ts'
import type { Deal } from '@/kernel/types'

const DEBOUNCE_MS = 1000
const EXIT_MS = 220
const ENTER_MS = 380

type AnimPhase = 'visible' | 'exiting' | 'entering'

export function useDeals(
    filters: DashboardFilters,
    setError: Dispatch<SetStateAction<string | null>>,
) {
    const [debouncedFilters, setDebouncedFilters] = useState(filters)
    const isFirstRender = useRef(true)

    useEffect(() => {
        const delay = isFirstRender.current ? 0 : DEBOUNCE_MS
        isFirstRender.current = false
        const timer = setTimeout(() => setDebouncedFilters(filters), delay)
        return () => clearTimeout(timer)
    }, [filters])

    const isDebouncing = filters !== debouncedFilters

    const {
        data,
        isFetching,
        error: queryError,
    } = useQuery({
        ...serviceFunnelQuery(debouncedFilters),
        placeholderData: keepPreviousData,
    })

    const [deals, setDeals] = useState<Deal[]>([])
    const [KPI, setKPI] = useState<Partial<DashboardKPI>>({})
    const [animPhase, setAnimPhase] = useState<AnimPhase>('visible')

    const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hasDataRef = useRef(false)

    useEffect(() => {
        if (!data) return
        if (animTimerRef.current) clearTimeout(animTimerRef.current)

        if (!hasDataRef.current) {
            hasDataRef.current = true
            setDeals(data.deals)
            setKPI(data.KPI)
            setAnimPhase('entering')
            animTimerRef.current = setTimeout(() => setAnimPhase('visible'), ENTER_MS)
        } else {
            setAnimPhase('exiting')
            animTimerRef.current = setTimeout(() => {
                setDeals(data.deals)
                setKPI(data.KPI)
                setAnimPhase('entering')
                animTimerRef.current = setTimeout(() => setAnimPhase('visible'), ENTER_MS)
            }, EXIT_MS)
        }
    }, [data])

    useEffect(() => {
        if (queryError) setError(queryError.message ?? 'Не удалось загрузить данные')
    }, [queryError, setError])

    useEffect(() => {
        return () => {
            if (animTimerRef.current) clearTimeout(animTimerRef.current)
        }
    }, [])

    const loading = isDebouncing || isFetching
    const isInitialLoad = loading && deals.length === 0
    const isRefreshing = loading && !isInitialLoad

    const animClass =
        animPhase === 'exiting'
            ? 'animate-out fade-out-0 slide-out-to-bottom-2 [animation-duration:220ms] [animation-fill-mode:forwards] pointer-events-none'
            : animPhase === 'entering'
              ? 'animate-in fade-in-0 slide-in-from-bottom-2 [animation-duration:380ms]'
              : ''

    const blurClass =
        isRefreshing && animPhase === 'visible'
            ? 'blur-[1.5px] transition-[filter] duration-500 pointer-events-none'
            : 'blur-0 transition-[filter] duration-300'

    return { loading, isInitialLoad, animClass, blurClass, deals, KPI }
}
