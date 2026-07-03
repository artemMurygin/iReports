import axios from 'axios'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/shared/axios.instance'
import type {
    ServicesFilters,
    ServicesAnalyticsResponse,
    ServiceAnalyticsEntry,
    ServiceCategory,
} from '../types'
import { buildChartSeries, resolveDescendantIds } from '../utils/categoryTree'

const DEBOUNCE_MS = 1000
const EXIT_MS = 220
const ENTER_MS = 380

type AnimPhase = 'visible' | 'exiting' | 'entering'

export function useServicesAnalytics(filters: ServicesFilters, categories: ServiceCategory[]) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [services, setServices] = useState<ServiceAnalyticsEntry[]>([])
    const [displayedServices, setDisplayedServices] = useState<ServiceAnalyticsEntry[]>([])
    const [displayedCategoryId, setDisplayedCategoryId] = useState<string | null>(null)
    const [animPhase, setAnimPhase] = useState<AnimPhase>('visible')

    const resolvedCategoryIds = useMemo(() => {
        if (!filters.selectedCategoryId) return []
        return resolveDescendantIds(categories, filters.selectedCategoryId)
    }, [filters.selectedCategoryId, categories])

    const abortRef = useRef<AbortController | null>(null)
    const isFirstRender = useRef(true)
    const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const loadingToastId = useRef<string | number | undefined>(undefined)
    const displayedServicesRef = useRef(displayedServices)
    displayedServicesRef.current = displayedServices
    const filtersRef = useRef(filters)
    filtersRef.current = filters
    const resolvedCategoryIdsRef = useRef(resolvedCategoryIds)
    resolvedCategoryIdsRef.current = resolvedCategoryIds

    useEffect(() => {
        if (!filters.dateRange.from || !filters.dateRange.to) return

        setLoading(true)
        const delay = isFirstRender.current ? 0 : DEBOUNCE_MS
        isFirstRender.current = false

        const timer = setTimeout(() => {
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller

            api.get<ServicesAnalyticsResponse>('/reports/services-analytics', {
                signal: controller.signal,
                params: {
                    momentFrom: filters.dateRange.from!.toISOString(),
                    momentTo: filters.dateRange.to!.toISOString(),
                    groupBy: filters.groupBy,
                    categoryIds: resolvedCategoryIdsRef.current,
                    serviceIds: filters.serviceIds.map(Number),
                },
            })
                .then((res) => {
                    const newServices = res.data.services
                    const categoryId = filtersRef.current.selectedCategoryId

                    if (animTimerRef.current) clearTimeout(animTimerRef.current)

                    if (displayedServicesRef.current.length === 0) {
                        setServices(newServices)
                        setDisplayedServices(newServices)
                        setDisplayedCategoryId(categoryId)
                        setAnimPhase('entering')
                        setError(null)
                        setLoading(false)
                        animTimerRef.current = setTimeout(() => setAnimPhase('visible'), ENTER_MS)
                    } else {
                        setServices(newServices)
                        setAnimPhase('exiting')
                        setError(null)
                        setLoading(false)
                        animTimerRef.current = setTimeout(() => {
                            setDisplayedServices(newServices)
                            setDisplayedCategoryId(categoryId)
                            setAnimPhase('entering')
                            animTimerRef.current = setTimeout(
                                () => setAnimPhase('visible'),
                                ENTER_MS,
                            )
                        }, EXIT_MS)
                    }
                })
                .catch((err) => {
                    if (!axios.isCancel(err)) {
                        setError('Не удалось загрузить данные')
                        setLoading(false)
                    }
                })
        }, delay)

        return () => {
            clearTimeout(timer)
            abortRef.current?.abort()
        }
    }, [filters])

    useEffect(() => {
        if (loading && displayedServices.length !== 0) {
            loadingToastId.current = toast.loading('Обновление данных...')
        } else {
            if (loadingToastId.current !== undefined) {
                toast.dismiss(loadingToastId.current)
                loadingToastId.current = undefined
            }
        }
    }, [loading])

    const { series } = useMemo(
        () => buildChartSeries(displayedServices, categories, displayedCategoryId),
        [displayedServices, categories, displayedCategoryId],
    )

    const isInitialLoad = loading && displayedServices.length === 0
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

    return {
        services,
        displayedServices,
        series,
        loading,
        error,
        isInitialLoad,
        animClass,
        blurClass,
    }
}
