import axios from 'axios';
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react';
import { api } from '@/shared/axios.instance.ts';
import type { DashboardFilters, DashboardKPI } from '@/pages/FunnelReportService/types.ts';

const DEBOUNCE_MS = 1000

export function useDeals(
    filters: DashboardFilters,
    setError: Dispatch<SetStateAction<string | null>>,
) {
    const [deals, setDeals] = useState([])
    const [KPI, setKPI] = useState<Partial<DashboardKPI>>({})
    const [loading, setLoading] = useState(false)
    const abortControllerRef = useRef<AbortController | null>(null)

    useEffect(() => {
        setLoading(true)
        const timer = setTimeout(() => {
            abortControllerRef.current?.abort()
            const controller = new AbortController()
            abortControllerRef.current = controller
            const { dateRange, stages, managers, sources, deviceTypes, stageGroups } = filters

            api.get("/reports/service-funnel", {
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
                .then(response => {
                    const { KPI, deals } = response.data
                    setDeals(deals)
                    setKPI(KPI)
                })
                .catch(error => {
                    if (!axios.isCancel(error)) setError(error)
                })
                .finally(() => setLoading(false))
        }, DEBOUNCE_MS)

        return () => {
            clearTimeout(timer)
            abortControllerRef.current?.abort()
        }
    }, [filters])

    return {
        loading,
        deals,
        KPI
    }
}