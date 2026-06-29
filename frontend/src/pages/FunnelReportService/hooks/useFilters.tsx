import { useEffect, useState } from 'react';
import type { DashboardFilters } from '@/pages/FunnelReportService/types.ts';
import { api } from '@/shared/axios.instance.ts';
import type { ApiStageExtended } from '@/types/deal.ts';
import { startOfMonth } from 'date-fns';
import { loadFilters, saveFilters, parseDate } from '@/shared/lib/persistFilters.ts';

const STORAGE_KEY = 'filters:funnel-report'

const today = new Date()

function makeDefaultFilters(): DashboardFilters {
    return {
        dateRange: { from: startOfMonth(today), to: new Date() },
        managers: [],
        sources: [],
        deviceTypes: [],
        stages: [],
        stageGroups: [],
    }
}

function revive(parsed: Record<string, unknown>): DashboardFilters {
    const defaults = makeDefaultFilters()
    const dr = parsed.dateRange as Record<string, unknown> | undefined
    return {
        dateRange: {
            from: parseDate(dr?.from) ?? defaults.dateRange.from,
            to:   parseDate(dr?.to)   ?? defaults.dateRange.to,
        },
        managers:    Array.isArray(parsed.managers)    ? parsed.managers    : [],
        sources:     Array.isArray(parsed.sources)     ? parsed.sources     : [],
        deviceTypes: Array.isArray(parsed.deviceTypes) ? parsed.deviceTypes : [],
        stages:      Array.isArray(parsed.stages)      ? parsed.stages      : [],
        stageGroups: Array.isArray(parsed.stageGroups) ? parsed.stageGroups : [],
    }
}

export function useFilters(){
    const [filters, setFiltersState] = useState<DashboardFilters>(() =>
        loadFilters(STORAGE_KEY, makeDefaultFilters(), revive)
    )
    const [employees, setEmployees] = useState([])
    const [sources, setSources] = useState([])
    const [deviceTypes, setDeviceTypes] = useState([])
    const [stages, setStages] = useState<ApiStageExtended[]>([])
    const [stageGroups, setStageGroups] = useState<{ id: string; name: string }[]>([])
    const [error, setError] = useState<string | null>(null)

    const setFilters = (value: DashboardFilters) => {
        saveFilters(STORAGE_KEY, value)
        setFiltersState(value)
    }

    const defaultFilters = makeDefaultFilters()

    useEffect(() => {
        Promise.all([
            api.get("/deals/stages"),
            api.get("/deals/managers"),
            api.get("/deals/sources"),
            api.get("/deals/models"),
            api.get("/deals/stage-groups"),
        ]).then(([stagesRes, managersRes, sourcesRes, modelsRes, stageGroupsRes]) => {
            setStages(stagesRes.data)
            setEmployees(managersRes.data)
            setSources(sourcesRes.data)
            setDeviceTypes(modelsRes.data)
            setStageGroups(stageGroupsRes.data)
        }).catch(err => setError(err?.message ?? 'Не удалось загрузить данные'))
    }, []);

    return {
        filters,
        employees,
        sources,
        deviceTypes,
        stages,
        stageGroups,
        setFilters,
        setError,
        error,
        defaultFilters
    }
}
