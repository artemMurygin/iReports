import axios from 'axios'
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react'
import { api } from '@/shared/axios.instance.ts'
import type { DashboardFilters, DashboardKPI } from '@/pages/FunnelReportService/types.ts'

const DEBOUNCE_MS = 1000
const EXIT_MS = 220
const ENTER_MS = 380

type AnimPhase = 'visible' | 'exiting' | 'entering'

export function useDeals(
    filters: DashboardFilters,
    setError: Dispatch<SetStateAction<string | null>>,
) {
    const [deals, setDeals] = useState([])
    const [KPI, setKPI] = useState<Partial<DashboardKPI>>({})
    const [loading, setLoading] = useState(true)
    const [animPhase, setAnimPhase] = useState<AnimPhase>('visible')

    const abortControllerRef = useRef<AbortController | null>(null)
    const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isFirstRender = useRef(true)
    const dealsRef = useRef(deals)
    dealsRef.current = deals

    useEffect(() => {
        setLoading(true)
        const delay = isFirstRender.current ? 0 : DEBOUNCE_MS
        isFirstRender.current = false

        const timer = setTimeout(() => {
            abortControllerRef.current?.abort()
            const controller = new AbortController()
            abortControllerRef.current = controller
            const { dateRange, stages, managers, sources, deviceTypes, stageGroups } = filters

            api.get('/reports/service-funnel', {
                signal: controller.signal,
                params: {
                    momentFrom: dateRange.from,
                    momentTo: dateRange.to,
                    stageIds: stages,
                    managerIds: managers,
                    sourceIds: sources,
                    modelIds: deviceTypes,
                    stageGroupIds: stageGroups,
                },
            })
                .then((response) => {
                    const { KPI, deals: newDeals } = response.data

                    if (animTimerRef.current) clearTimeout(animTimerRef.current)

                    if (dealsRef.current.length === 0) {
                        setDeals(newDeals)
                        setKPI(KPI)
                        setAnimPhase('entering')
                        setLoading(false)
                        animTimerRef.current = setTimeout(() => setAnimPhase('visible'), ENTER_MS)
                    } else {
                        setAnimPhase('exiting')
                        setLoading(false)
                        animTimerRef.current = setTimeout(() => {
                            setDeals(newDeals)
                            setKPI(KPI)
                            setAnimPhase('entering')
                            animTimerRef.current = setTimeout(
                                () => setAnimPhase('visible'),
                                ENTER_MS,
                            )
                        }, EXIT_MS)
                    }
                })
                .catch((error) => {
                    if (!axios.isCancel(error)) {
                        setError(error?.message ?? 'Не удалось загрузить данные')
                        setLoading(false)
                    }
                })
        }, delay)

        return () => {
            clearTimeout(timer)
            abortControllerRef.current?.abort()
        }
    }, [filters])

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
